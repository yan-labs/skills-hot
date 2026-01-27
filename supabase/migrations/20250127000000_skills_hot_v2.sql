-- ========================================
-- Skills Hot V2 Migration
-- 添加 authors, external_skills, skill_files 表
-- 支持 GitHub 来源的 skills 和用户认领机制
-- ========================================

-- ========================================
-- 1. authors 表：作者索引
-- ========================================
CREATE TABLE IF NOT EXISTS authors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id     BIGINT UNIQUE NOT NULL,      -- GitHub 用户 ID（主要标识）
  github_login  TEXT NOT NULL,               -- GitHub 用户名
  name          TEXT,                        -- 显示名称
  avatar_url    TEXT,                        -- 头像 URL
  bio           TEXT,                        -- 简介
  user_id       UUID REFERENCES auth.users(id), -- 关联平台用户（登录后填充）

  -- 统计字段（定期更新）
  external_skill_count INTEGER DEFAULT 0,   -- 来自 GitHub 的 skills 数量
  native_skill_count   INTEGER DEFAULT 0,   -- 平台原生 skills 数量
  total_installs       INTEGER DEFAULT 0,   -- 总安装数

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authors_github_id ON authors(github_id);
CREATE INDEX IF NOT EXISTS idx_authors_github_login ON authors(github_login);
CREATE INDEX IF NOT EXISTS idx_authors_user_id ON authors(user_id);

-- ========================================
-- 2. external_skills 表：GitHub 来源的 skills（只存元数据）
-- ========================================
CREATE TABLE IF NOT EXISTS external_skills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 唯一标识
  source        TEXT NOT NULL DEFAULT 'github', -- 来源：github, skillsmp, etc.
  source_id     TEXT NOT NULL,                  -- 源平台 ID（如 skills.sh 的 name）

  -- 基本信息
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,                 -- URL friendly slug
  description   TEXT,

  -- GitHub 信息
  repo          TEXT NOT NULL,                 -- owner/repo
  repo_path     TEXT,                          -- skills 在仓库中的路径
  branch        TEXT DEFAULT 'main',
  raw_url       TEXT,                          -- SKILL.md 的 raw URL

  -- 作者关联
  author_id     UUID REFERENCES authors(id),
  github_owner  TEXT,                          -- 仓库所有者

  -- 统计（从 skills.sh 同步）
  installs      INTEGER DEFAULT 0,
  stars         INTEGER DEFAULT 0,

  -- 同步状态
  synced_at     TIMESTAMPTZ,                   -- 最后同步时间
  verified      BOOLEAN DEFAULT FALSE,         -- 是否经过验证

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_external_skills_slug ON external_skills(slug);
CREATE INDEX IF NOT EXISTS idx_external_skills_author ON external_skills(author_id);
CREATE INDEX IF NOT EXISTS idx_external_skills_repo ON external_skills(repo);
CREATE INDEX IF NOT EXISTS idx_external_skills_installs ON external_skills(installs DESC);
CREATE INDEX IF NOT EXISTS idx_external_skills_name ON external_skills(name);

-- ========================================
-- 3. 扩展 skills 表：添加作者关联和导入来源
-- ========================================
ALTER TABLE skills ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES authors(id);
ALTER TABLE skills ADD COLUMN IF NOT EXISTS imported_from UUID REFERENCES external_skills(id);

CREATE INDEX IF NOT EXISTS idx_skills_author_id ON skills(author_id);
CREATE INDEX IF NOT EXISTS idx_skills_imported_from ON skills(imported_from);

-- ========================================
-- 4. skill_files 表：skills 附属文件
-- ========================================
CREATE TABLE IF NOT EXISTS skill_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,                 -- 相对路径
  file_type     TEXT,                          -- 文件类型
  file_size     INTEGER,                       -- 文件大小
  storage_key   TEXT,                          -- R2/Storage 中的 key
  content_hash  TEXT,                          -- 内容 hash（用于去重）
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(skill_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_skill_files_skill ON skill_files(skill_id);

-- ========================================
-- 5. 触发器：更新 authors.updated_at
-- ========================================
CREATE TRIGGER trigger_update_authors_updated_at
BEFORE UPDATE ON authors
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================================
-- 6. 触发器：更新 external_skills.updated_at
-- ========================================
CREATE TRIGGER trigger_update_external_skills_updated_at
BEFORE UPDATE ON external_skills
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================================
-- 7. RLS 策略
-- ========================================
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_files ENABLE ROW LEVEL SECURITY;

-- Authors 公开读取
CREATE POLICY "Authors are publicly readable" ON authors
  FOR SELECT USING (true);

-- Authors 只能由本人更新自己的记录（通过 user_id）
CREATE POLICY "Users can update own author profile" ON authors
  FOR UPDATE USING (auth.uid() = user_id);

-- External skills 公开读取
CREATE POLICY "External skills are publicly readable" ON external_skills
  FOR SELECT USING (true);

-- Skill files 公开读取
CREATE POLICY "Skill files are publicly readable" ON skill_files
  FOR SELECT USING (true);

-- ========================================
-- 8. 函数：更新作者统计
-- ========================================
CREATE OR REPLACE FUNCTION update_author_stats(p_author_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE authors
  SET
    external_skill_count = (
      SELECT COUNT(*) FROM external_skills WHERE author_id = p_author_id
    ),
    native_skill_count = (
      SELECT COUNT(*) FROM skills WHERE author_id = p_author_id
    ),
    total_installs = (
      SELECT COALESCE(SUM(installs), 0) FROM external_skills WHERE author_id = p_author_id
    ) + (
      SELECT COALESCE(SUM(ss.installs), 0)
      FROM skills s
      JOIN skill_stats ss ON ss.skill_id = s.id
      WHERE s.author_id = p_author_id
    ),
    updated_at = NOW()
  WHERE id = p_author_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 9. 函数：检查 skill 访问权限（扩展支持 external_skills）
-- ========================================
CREATE OR REPLACE FUNCTION has_skill_access(p_skill_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_skill RECORD;
  v_access RECORD;
BEGIN
  -- 获取 skill 信息
  SELECT * INTO v_skill FROM skills WHERE id = p_skill_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 公开 skill 允许访问
  IF NOT v_skill.is_private THEN
    RETURN TRUE;
  END IF;

  -- 所有者可以访问
  IF v_skill.user_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- 检查访问权限
  SELECT * INTO v_access
  FROM skill_access
  WHERE skill_id = p_skill_id
    AND user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW());

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 10. 触发器：external_skills 插入/更新后更新作者统计
-- ========================================
CREATE OR REPLACE FUNCTION trigger_update_author_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.author_id IS NOT NULL THEN
      PERFORM update_author_stats(NEW.author_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.author_id IS NOT NULL AND OLD.author_id != NEW.author_id THEN
      PERFORM update_author_stats(OLD.author_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.author_id IS NOT NULL THEN
      PERFORM update_author_stats(OLD.author_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_external_skills_update_author_stats
AFTER INSERT OR UPDATE OR DELETE ON external_skills
FOR EACH ROW EXECUTE FUNCTION trigger_update_author_stats();

CREATE TRIGGER trigger_skills_update_author_stats
AFTER INSERT OR UPDATE OR DELETE ON skills
FOR EACH ROW EXECUTE FUNCTION trigger_update_author_stats();
