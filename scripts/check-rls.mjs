#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Check RLS policies
const { data: policies } = await admin
  .rpc('get_policies_for_table', { table_name: 'skill_snapshots' });

if (!policies) {
  // Try direct SQL query
  const { data: direct } = await admin
    .from('pg_tables')
    .select('*')
    .eq('tablename', 'skill_snapshots');

  console.log('skill_snapshots table exists:', direct?.length > 0);

  // Check if RLS is enabled
  const { data: rls } = await admin
    .from('pg_class')
    .select('relname, relrowsecurity, relforcerowsecurity')
    .eq('relname', 'skill_snapshots');

  console.log('RLS enabled:', rls?.[0]?.relrowsecurity || false);
} else {
  console.log('RLS policies for skill_snapshots:');
  for (const p of policies) {
    console.log(`  - ${p.policyname}: ${p.roles} (SELECT: ${p.cmd})`);
  }
}

// Test anon key access
const { createClient: createAnonClient } = await import('@supabase/supabase-js');
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const anon = createAnonClient(SUPABASE_URL, ANON_KEY);

const { data: testData, error } = await anon
  .from('skill_snapshots')
  .select('skill_name')
  .eq('is_dropped', true)
  .limit(1);

console.log('\nAnon key access:');
console.log('  Error:', error?.message || 'none');
console.log('  Data:', testData?.length || 0, 'records');
