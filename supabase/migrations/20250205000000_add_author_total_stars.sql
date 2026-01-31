-- 添加 total_stars 字段到 authors 表
ALTER TABLE authors ADD COLUMN IF NOT EXISTS total_stars INTEGER DEFAULT 0;

-- 创建索引以支持排序
CREATE INDEX IF NOT EXISTS idx_authors_total_stars ON authors(total_stars DESC);

-- 更新现有作者的 total_stars（从 external_skills 聚合）
UPDATE authors a
SET total_stars = COALESCE((
  SELECT SUM(es.stars)
  FROM external_skills es
  WHERE es.author_id = a.id
), 0);
