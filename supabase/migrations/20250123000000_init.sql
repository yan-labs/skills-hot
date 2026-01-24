-- SkillBank Database Schema

-- skills 表：存储 skill 元数据
CREATE TABLE skills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  description   TEXT,
  content       TEXT,
  author        TEXT,
  source_url    TEXT,
  category      TEXT,
  tags          TEXT[],
  is_paid       BOOLEAN DEFAULT FALSE,
  price         DECIMAL(10,2),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- skill_stats 表：统计数据
CREATE TABLE skill_stats (
  skill_id      UUID REFERENCES skills(id) ON DELETE CASCADE,
  installs      INTEGER DEFAULT 0,
  views         INTEGER DEFAULT 0,
  copies        INTEGER DEFAULT 0,
  favorites     INTEGER DEFAULT 0,
  PRIMARY KEY (skill_id)
);

-- stat_events 表：统计事件日志
CREATE TABLE stat_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID REFERENCES skills(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_skills_slug ON skills(slug);
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_stat_events_skill_created ON stat_events(skill_id, created_at);

-- 触发器：自动创建 skill_stats 记录
CREATE OR REPLACE FUNCTION create_skill_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO skill_stats (skill_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_skill_stats
AFTER INSERT ON skills
FOR EACH ROW EXECUTE FUNCTION create_skill_stats();

-- 触发器：更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_skills_updated_at
BEFORE UPDATE ON skills
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 启用 RLS
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_events ENABLE ROW LEVEL SECURITY;

-- 公开读取策略
CREATE POLICY "Skills are publicly readable" ON skills
  FOR SELECT USING (true);

CREATE POLICY "Skill stats are publicly readable" ON skill_stats
  FOR SELECT USING (true);

-- 允许匿名用户插入统计事件
CREATE POLICY "Anyone can insert stat events" ON stat_events
  FOR INSERT WITH CHECK (true);

-- 插入一些示例数据
INSERT INTO skills (name, slug, description, content, author, category, tags) VALUES
(
  'git-commit',
  'git-commit',
  'Best practices for creating meaningful git commits',
  E'# Git Commit Skill\n\n## Overview\nThis skill helps you create better git commits.\n\n## Instructions\n- Write clear commit messages\n- Use conventional commit format\n- Keep commits atomic',
  'anthropics',
  'development',
  ARRAY['git', 'version-control', 'best-practices']
),
(
  'code-review',
  'code-review',
  'Guidelines for performing effective code reviews',
  E'# Code Review Skill\n\n## Overview\nThis skill provides guidelines for code reviews.\n\n## Instructions\n- Focus on logic and correctness\n- Be constructive in feedback\n- Look for security issues',
  'anthropics',
  'development',
  ARRAY['review', 'quality', 'collaboration']
),
(
  'testing',
  'testing',
  'Testing strategies and best practices for software development',
  E'# Testing Skill\n\n## Overview\nComprehensive testing strategies.\n\n## Instructions\n- Write unit tests first\n- Use integration tests for workflows\n- Aim for meaningful coverage',
  'community',
  'development',
  ARRAY['testing', 'quality', 'tdd']
),
(
  'typescript-patterns',
  'typescript-patterns',
  'Common TypeScript patterns and best practices',
  E'# TypeScript Patterns\n\n## Overview\nUseful TypeScript patterns.\n\n## Instructions\n- Use strict mode\n- Prefer interfaces over types\n- Leverage generics',
  'community',
  'development',
  ARRAY['typescript', 'patterns', 'best-practices']
),
(
  'api-design',
  'api-design',
  'REST API design principles and conventions',
  E'# API Design Skill\n\n## Overview\nDesign better REST APIs.\n\n## Instructions\n- Use proper HTTP methods\n- Version your APIs\n- Return meaningful errors',
  'anthropics',
  'api-backend',
  ARRAY['api', 'rest', 'backend']
);
