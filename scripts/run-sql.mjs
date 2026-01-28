#!/usr/bin/env node
/**
 * 通过 Supabase REST API 执行 SQL
 * 用法: node scripts/run-sql.mjs <sql-file>
 */

import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 需要设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('用法: node scripts/run-sql.mjs <sql-file>');
  process.exit(1);
}

const sql = readFileSync(sqlFile, 'utf-8');
console.log(`📄 执行 SQL 文件: ${sqlFile}\n`);

// 使用 Supabase REST API 执行 SQL
const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ query: sql }),
});

if (!response.ok) {
  // 如果 exec_sql 函数不存在，尝试分割 SQL 语句逐个执行
  console.log('exec_sql RPC 不可用，尝试其他方式...\n');

  // 分割 SQL 语句
  const statements = sql
    .split(/;[\s]*\n/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  console.log(`共 ${statements.length} 条语句\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;

    // 跳过 DO $$ 块，Supabase REST 不支持
    if (stmt.includes('DO $$')) {
      console.log(`⏭️  [${i + 1}] 跳过 DO 块 (需手动执行)`);
      continue;
    }

    console.log(`[${i + 1}/${statements.length}] ${stmt.substring(0, 60)}...`);
  }

  console.log('\n⚠️  请在 Supabase Dashboard SQL Editor 中手动执行迁移文件');
  console.log(`    文件: ${sqlFile}`);
} else {
  const result = await response.json();
  console.log('✅ SQL 执行成功');
  console.log(result);
}
