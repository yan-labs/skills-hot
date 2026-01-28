-- ========================================
-- 添加 GitHub 同步需要的字段到 external_skills 表
-- ========================================

-- GitHub 统计字段
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS forks INTEGER DEFAULT 0;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS watchers INTEGER DEFAULT 0;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS open_issues INTEGER DEFAULT 0;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS releases_count INTEGER DEFAULT 0;

-- GitHub 元数据
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS primary_language TEXT;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS topics TEXT[];
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS license TEXT;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS is_fork BOOLEAN DEFAULT FALSE;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS default_branch TEXT DEFAULT 'main';

-- GitHub 时间戳
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS github_pushed_at TIMESTAMPTZ;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS github_created_at TIMESTAMPTZ;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS github_updated_at TIMESTAMPTZ;

-- GitHub 描述（区别于 description，这个是从 GitHub 同步的）
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS github_description TEXT;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS github_homepage TEXT;

-- Owner 头像
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS owner_avatar TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_external_skills_stars ON external_skills(stars DESC);
CREATE INDEX IF NOT EXISTS idx_external_skills_language ON external_skills(primary_language);
CREATE INDEX IF NOT EXISTS idx_external_skills_github_pushed ON external_skills(github_pushed_at DESC);

-- 添加 authors 表的 github_login 唯一约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'authors_github_login_key'
  ) THEN
    ALTER TABLE authors ADD CONSTRAINT authors_github_login_key UNIQUE (github_login);
  END IF;
END
$$;
