-- 添加 content_updated_at 字段记录 skill 文件最后更新时间
ALTER TABLE external_skills
ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMPTZ;

-- 添加索引以支持按更新时间排序
CREATE INDEX IF NOT EXISTS idx_external_skills_content_updated_at
ON external_skills(content_updated_at DESC NULLS LAST);

COMMENT ON COLUMN external_skills.content_updated_at IS 'GitHub 上 SKILL.md 文件的最后提交时间';
