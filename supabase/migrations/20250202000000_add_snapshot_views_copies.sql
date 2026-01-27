-- ========================================
-- 扩展 skill_snapshots 表：添加 views 和 copies 字段
-- 用于追踪技能的浏览量和复制次数趋势
-- ========================================

-- 1. 添加 views 和 copies 字段
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS copies INTEGER DEFAULT 0;

-- 2. 添加变化量字段
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS views_delta INTEGER DEFAULT 0;
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS copies_delta INTEGER DEFAULT 0;

-- 3. 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_snapshots_views ON skill_snapshots(snapshot_at, views DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_copies ON skill_snapshots(snapshot_at, copies DESC);

-- 4. 更新 get_trending_data 函数，包含 views 和 copies
CREATE OR REPLACE FUNCTION get_trending_data()
RETURNS JSON AS $$
DECLARE
  latest_snapshot TIMESTAMPTZ;
  result JSON;
BEGIN
  -- 获取最新快照时间
  SELECT MAX(snapshot_at) INTO latest_snapshot FROM skill_snapshots;

  IF latest_snapshot IS NULL THEN
    RETURN '{"rising":[],"declining":[],"newEntries":[],"dropped":[],"surging":[]}'::JSON;
  END IF;

  -- 构建结果
  SELECT json_build_object(
    'snapshotAt', latest_snapshot,
    'rising', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT skill_name as name, skill_slug as slug, github_owner as author,
               installs, stars, views, copies, rank_delta as "rankDelta"
        FROM skill_snapshots
        WHERE snapshot_at = latest_snapshot AND rank_delta > 0 AND NOT is_new
        ORDER BY rank_delta DESC
        LIMIT 5
      ) r
    ),
    'declining', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT skill_name as name, skill_slug as slug, github_owner as author,
               installs, stars, views, copies, rank_delta as "rankDelta"
        FROM skill_snapshots
        WHERE snapshot_at = latest_snapshot AND rank_delta < 0
        ORDER BY rank_delta ASC
        LIMIT 5
      ) r
    ),
    'newEntries', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT skill_name as name, skill_slug as slug, github_owner as author,
               installs, stars, views, copies, rank
        FROM skill_snapshots
        WHERE snapshot_at = latest_snapshot AND is_new = TRUE
        ORDER BY rank ASC
        LIMIT 5
      ) r
    ),
    'dropped', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT skill_name as name, skill_slug as slug, github_owner as author,
               installs, stars, views, copies, rank as "previousRank"
        FROM skill_snapshots
        WHERE snapshot_at = latest_snapshot AND is_dropped = TRUE
        ORDER BY rank ASC
        LIMIT 5
      ) r
    ),
    'surging', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT skill_name as name, skill_slug as slug, github_owner as author,
               installs, stars, views, copies, installs_rate as "installsRate"
        FROM skill_snapshots
        WHERE snapshot_at = latest_snapshot AND installs_rate >= 0.3
        ORDER BY installs_rate DESC
        LIMIT 5
      ) r
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 添加获取技能历史统计的函数（用于绘制曲线图）
CREATE OR REPLACE FUNCTION get_skill_stats_history(p_skill_name TEXT, p_days INTEGER DEFAULT 30)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.snapshot_at), '[]'::JSON)
    FROM (
      SELECT
        snapshot_at,
        rank,
        installs,
        stars,
        views,
        copies,
        rank_delta,
        installs_delta,
        views_delta,
        copies_delta
      FROM skill_snapshots
      WHERE skill_name = p_skill_name
        AND snapshot_at >= NOW() - (p_days || ' days')::INTERVAL
      ORDER BY snapshot_at ASC
    ) r
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 注释
COMMENT ON COLUMN skill_snapshots.views IS '浏览量';
COMMENT ON COLUMN skill_snapshots.copies IS '复制次数';
COMMENT ON COLUMN skill_snapshots.views_delta IS '浏览量变化（与上一快照对比）';
COMMENT ON COLUMN skill_snapshots.copies_delta IS '复制次数变化（与上一快照对比）';
COMMENT ON FUNCTION get_skill_stats_history IS '获取技能历史统计数据，用于绘制趋势曲线图';
