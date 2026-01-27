#!/bin/bash
# 检查迁移状态并输出需要执行的 SQL

SUPABASE_URL="https://eccwfcfoysauxnnsvcwn.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY3dmY2ZveXNhdXhubnN2Y3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwOTgyMjUsImV4cCI6MjA4NDY3NDIyNX0.ToVALp0oGi3WxkmwY-nTL35nJVbhYATDiNkYQQKhcgI"

echo "=== 检查当前表结构 ==="
RESULT=$(curl -s "$SUPABASE_URL/rest/v1/skill_snapshots?limit=1" -H "apikey: $ANON_KEY")

if echo "$RESULT" | grep -q '"views"'; then
  echo "✅ views 字段已存在"
else
  echo "❌ views 字段不存在"
fi

if echo "$RESULT" | grep -q '"copies"'; then
  echo "✅ copies 字段已存在"
else
  echo "❌ copies 字段不存在"
fi

echo ""
echo "=== 请手动在 Supabase Dashboard 执行迁移 ==="
echo ""
echo "1. 访问: https://supabase.com/dashboard/project/eccwfcfoysauxnnsvcwn/sql"
echo "2. 粘贴以下 SQL 并执行:"
echo ""
cat << 'EOF'
-- 添加字段
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS copies INTEGER DEFAULT 0;
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS views_delta INTEGER DEFAULT 0;
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS copies_delta INTEGER DEFAULT 0;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_snapshots_views ON skill_snapshots(snapshot_at, views DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_copies ON skill_snapshots(snapshot_at, copies DESC);

-- 添加获取历史统计的函数
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
EOF
