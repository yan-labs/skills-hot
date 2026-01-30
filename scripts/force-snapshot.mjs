#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  // 1. 删除所有 14:00 的快照
  console.log('🗑️  删除 14:00 快照...');
  await supabase
    .from('skill_snapshots')
    .delete()
    .eq('snapshot_at', '2026-01-30T14:00:00+00:00');
  console.log('   ✅ 完成');

  // 2. 将 13:00 快照改为 12:00（模拟一小时前的快照）
  console.log('🔄 将 13:00 快照改为 12:00...');
  await supabase
    .from('skill_snapshots')
    .update({ snapshot_at: '2026-01-30T12:00:00+00:00' })
    .eq('snapshot_at', '2026-01-30T13:00:00+00:00');
  console.log('   ✅ 完成');

  console.log('\n✅ 完成！现在可以运行 snapshot.mjs 生成新的 14:00 快照');
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
