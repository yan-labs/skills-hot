import { createClient } from '@supabase/supabase-js';

const sql = `
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
    AND s.rank IS NOT NULL
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
`;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('创建 get_new_entries_24h 函数...');

// 使用 direct SQL 执行
const { data, error } = await supabase
  .from('skill_snapshots')
  .select('*')
  .limit(1);

if (error) {
  console.error('连接测试失败:', error);
  process.exit(1);
}

console.log('连接正常，需要手动在 Supabase Dashboard 执行 SQL');

console.log('\n请复制以下 SQL 到 Supabase Dashboard SQL Editor 执行:\n');
console.log(sql);

// 第二个函数
const sql2 = `
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
    AND old.rank IS NOT NULL
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
`;

console.log(sql2);
