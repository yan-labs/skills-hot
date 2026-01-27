import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 通过 Supabase connection pooler 执行 migration
 * 需要设置 DATABASE_URL 环境变量
 * 
 * 获取方式：
 * 1. 打开 https://supabase.com/dashboard/project/eccwfcfoysauxnnsvcwn/settings/database
 * 2. 复制 "Connection string" (Transaction pooler 模式)
 * 3. 设置环境变量：export DATABASE_URL="postgresql://..."
 */
async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Missing DATABASE_URL environment variable.');
    console.error('');
    console.error('To get your database URL:');
    console.error('1. Open https://supabase.com/dashboard/project/eccwfcfoysauxnnsvcwn/settings/database');
    console.error('2. Copy the "Connection string" (use Transaction pooler for serverless)');
    console.error('3. Run: DATABASE_URL="your-connection-string" npx tsx scripts/run-migration.ts');
    process.exit(1);
  }

  console.log('Connecting to Supabase database...');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log('Connected successfully!');

    // 检查表是否存在
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'skill_snapshots'
      );
    `);

    if (checkResult.rows[0].exists) {
      console.log('✓ Table skill_snapshots already exists!');
      client.release();
      await pool.end();
      return;
    }

    console.log('Table does not exist. Running migration...');

    // 读取 migration SQL
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250201000000_add_skill_snapshots.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // 执行 migration
    await client.query(migrationSql);
    console.log('✓ Migration completed successfully!');

    // 验证
    const verifyResult = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'skill_snapshots';
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✓ Table skill_snapshots created and verified!');
    }

    client.release();
    await pool.end();

  } catch (error) {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
