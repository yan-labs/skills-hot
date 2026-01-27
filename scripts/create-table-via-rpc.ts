import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  // 先检查表是否存在
  const { data, error } = await supabase
    .from('skill_snapshots')
    .select('id')
    .limit(1);

  if (!error) {
    console.log('✓ Table skill_snapshots already exists!');
    return;
  }

  if (error.code === 'PGRST205') {
    console.log('Table does not exist. Creating via SQL...');
    
    // Supabase 允许通过 service_role key 调用 postgres 函数
    // 但不能直接执行 DDL，需要用 Dashboard
    console.log('');
    console.log('Please run the migration SQL in Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/eccwfcfoysauxnnsvcwn/sql/new');
    console.log('');
    console.log('Or get your DATABASE_URL from:');
    console.log('https://supabase.com/dashboard/project/eccwfcfoysauxnnsvcwn/settings/database');
    console.log('(Click "Connection string" -> "URI" -> Copy)');
  } else {
    console.error('Error:', error);
  }
}

createTable();
