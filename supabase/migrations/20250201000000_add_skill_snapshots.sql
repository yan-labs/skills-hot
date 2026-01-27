-- ========================================
-- Skill Snapshots - 趋势追踪
-- 保存 Top 1000 技能的定期快照，用于计算趋势变化
-- ========================================

-- ========================================
-- 1. skill_snapshots 表：技能快照
-- ========================================
CREATE TABLE IF NOT EXISTS skill_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 快照时间（精确到小时，用于 6 小时间隔）
  snapshot_at   TIMESTAMPTZ NOT NULL,

  -- 技能信息
  skill_id      UUID REFERENCES external_skills(id) ON DELETE CASCADE,
  skill_name    TEXT NOT NULL,
  skill_slug    TEXT NOT NULL,
  github_owner  TEXT,

  -- 当前数据
  rank          INTEGER NOT NULL,       -- 当前排名（按安装量）
  installs      INTEGER NOT NULL,       -- 当前安装量
  stars         INTEGER DEFAULT 0,      -- 当前星标数

  -- 变化值（与上一快照对比）
  rank_delta    INTEGER DEFAULT 0,      -- 排名变化（正=上升）
  installs_delta INTEGER DEFAULT 0,     -- 安装量变化
  installs_rate REAL DEFAULT 0,         -- 安装量变化率

  -- 状态标记
  is_new        BOOLEAN DEFAULT FALSE,  -- 是否新晋
  is_dropped    BOOLEAN DEFAULT FALSE,  -- 是否掉榜（用于标记上一快照中存在但本次不在 Top 1000 的）

  created_at    TIMESTAMPTZ DEFAULT NOW(),

  -- 唯一约束：同一快照时间 + 同一技能只有一条记录
  UNIQUE(snapshot_at, skill_name)
);

-- 索引优化查询
CREATE INDEX IF NOT EXISTS idx_snapshots_time ON skill_snapshots(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_skill ON skill_snapshots(skill_name);
CREATE INDEX IF NOT EXISTS idx_snapshots_rank ON skill_snapshots(snapshot_at, rank);
CREATE INDEX IF NOT EXISTS idx_snapshots_rank_delta ON skill_snapshots(snapshot_at, rank_delta DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_installs_rate ON skill_snapshots(snapshot_at, installs_rate DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_new ON skill_snapshots(snapshot_at, is_new) WHERE is_new = TRUE;

-- ========================================
-- 2. RLS 策略
-- ========================================
ALTER TABLE skill_snapshots ENABLE ROW LEVEL SECURITY;

-- 公开读取
CREATE POLICY "Skill snapshots are publicly readable" ON skill_snapshots
  FOR SELECT USING (true);

-- ========================================
-- 3. 清理函数：删除超过 30 天的快照
-- ========================================
CREATE OR REPLACE FUNCTION cleanup_old_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM skill_snapshots
  WHERE snapshot_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 4. 获取最新趋势数据的函数
-- ========================================
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
               installs, rank_delta as "rankDelta"
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
               installs, rank as "previousRank"
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
               installs, installs_rate as "installsRate"
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

-- ========================================
-- 5. 注释
-- ========================================
COMMENT ON TABLE skill_snapshots IS '技能快照表，用于追踪 Top 1000 技能的排名和安装量变化';
COMMENT ON COLUMN skill_snapshots.snapshot_at IS '快照时间，每 6 小时一次';
COMMENT ON COLUMN skill_snapshots.rank IS '当前排名（按安装量排序）';
COMMENT ON COLUMN skill_snapshots.rank_delta IS '排名变化，正数表示上升';
COMMENT ON COLUMN skill_snapshots.installs_rate IS '安装量变化率，0.3 表示增长 30%';
COMMENT ON COLUMN skill_snapshots.is_new IS '是否是新晋 Top 1000';
COMMENT ON COLUMN skill_snapshots.is_dropped IS '是否从 Top 1000 掉出';
