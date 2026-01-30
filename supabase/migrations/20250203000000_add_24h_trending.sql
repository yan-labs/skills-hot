-- ========================================
-- 24小时趋势函数
-- New = 最近24小时内首次上榜
-- Dropped = 最近24小时内掉榜
-- ========================================

-- 获取新晋技能（24小时内首次出现）
CREATE OR REPLACE FUNCTION get_new_entries_24h(current_snapshot_at TIMESTAMPTZ, cutoff_at TIMESTAMPTZ)
RETURNS TABLE (
  skill_name TEXT,
  skill_slug TEXT,
  github_owner TEXT,
  installs INTEGER,
  rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.skill_name,
    s.skill_slug,
    s.github_owner,
    s.installs,
    s.rank
  FROM skill_snapshots s
  WHERE s.snapshot_at = current_snapshot_at
    -- 当前在榜单中
    AND s.rank IS NOT NULL
    -- 在 cutoff_at 之前的任何快照中都不存在
    AND NOT EXISTS (
      SELECT 1
      FROM skill_snapshots old
      WHERE old.skill_name = s.skill_name
        AND old.snapshot_at < cutoff_at
    )
  ORDER BY s.rank ASC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取掉榜技能（24小时内从榜单消失）
CREATE OR REPLACE FUNCTION get_dropped_24h(current_snapshot_at TIMESTAMPTZ, cutoff_at TIMESTAMPTZ)
RETURNS TABLE (
  skill_name TEXT,
  skill_slug TEXT,
  github_owner TEXT,
  installs INTEGER,
  previous_rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (old.skill_name)
    old.skill_name,
    old.skill_slug,
    old.github_owner,
    old.installs,
    old.rank AS previous_rank
  FROM skill_snapshots old
  WHERE old.snapshot_at >= cutoff_at
    AND old.snapshot_at < current_snapshot_at
    -- 在 cutoff_at 之后到 current_snapshot 之前存在过
    AND old.rank IS NOT NULL
    -- 但在当前快照中不存在
    AND NOT EXISTS (
      SELECT 1
      FROM skill_snapshots current
      WHERE current.snapshot_at = current_snapshot_at
        AND current.skill_name = old.skill_name
        AND current.rank IS NOT NULL
    )
  ORDER BY old.skill_name, old.snapshot_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新 get_trending_data 使用新的 24 小时逻辑
CREATE OR REPLACE FUNCTION get_trending_data_24h()
RETURNS JSON AS $$
DECLARE
  latest_snapshot TIMESTAMPTZ;
  cutoff_at TIMESTAMPTZ;
  result JSON;
BEGIN
  -- 获取最新快照时间
  SELECT MAX(snapshot_at) INTO latest_snapshot FROM skill_snapshots;

  IF latest_snapshot IS NULL THEN
    RETURN '{"rising":[],"declining":[],"newEntries":[],"dropped":[],"surging":[]}'::JSON;
  END IF;

  cutoff_at := latest_snapshot - INTERVAL '24 hours';

  -- 构建结果
  SELECT json_build_object(
    'snapshotAt', latest_snapshot,
    'rising', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT skill_name as name, skill_slug as slug, github_owner as author,
               installs, rank_delta as "rankDelta"
        FROM skill_snapshots
        WHERE snapshot_at = latest_snapshot AND rank_delta > 0
        ORDER BY rank_delta DESC
        LIMIT 5
      ) r
    ),
    'declining', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT skill_name as name, skill_slug as slug, github_owner as author,
               installs, rank_delta as "rankDelta"
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
               installs, rank
        FROM get_new_entries_24h(latest_snapshot, cutoff_at)
      ) r
    ),
    'dropped', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT skill_name as name, skill_slug as slug, github_owner as author,
               installs, previous_rank as "previousRank"
        FROM get_dropped_24h(latest_snapshot, cutoff_at)
      ) r
    ),
    'surging', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT skill_name as name, skill_slug as slug, github_owner as author,
               installs, installs_rate as "installsRate"
        FROM skill_snapshots
        WHERE snapshot_at = latest_snapshot AND installs_rate >= 0.2
        ORDER BY installs_rate DESC
        LIMIT 5
      ) r
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
