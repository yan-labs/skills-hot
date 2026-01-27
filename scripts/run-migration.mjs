#!/usr/bin/env node
/**
 * 通过 Supabase 执行数据库迁移
 * 使用 supabase.rpc 或直接 SQL
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eccwfcfoysauxnnsvcwn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY3dmY2ZveXNhdXhubnN2Y3duIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA5ODIyNSwiZXhwIjoyMDg0Njc0MjI1fQ._zm9Alm_TZyjTgzdle01NFMhCz7pyHADVwg6JEOA1l0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runMigration() {
  console.log('检查 skill_snapshots 表结构...');

  // 先查询表结构
  const { data: columns, error: colError } = await supabase
    .from('skill_snapshots')
    .select('*')
    .limit(1);

  if (colError) {
    console.error('查询失败:', colError.message);
    return;
  }

  if (columns && columns.length > 0) {
    const cols = Object.keys(columns[0]);
    console.log('当前字段:', cols.join(', '));

    if (cols.includes('views') && cols.includes('copies')) {
      console.log('✅ views 和 copies 字段已存在！');
    } else {
      console.log('❌ 需要添加 views 和 copies 字段');
      console.log('');
      console.log('请手动在 Supabase Dashboard SQL Editor 中执行以下 SQL:');
      console.log('');
      console.log(`
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS copies INTEGER DEFAULT 0;
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS views_delta INTEGER DEFAULT 0;
ALTER TABLE skill_snapshots ADD COLUMN IF NOT EXISTS copies_delta INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_snapshots_views ON skill_snapshots(snapshot_at, views DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_copies ON skill_snapshots(snapshot_at, copies DESC);
      `);
    }
  } else {
    console.log('表为空或不存在');
  }
}

runMigration().catch(console.error);
