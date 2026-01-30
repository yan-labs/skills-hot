#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Update all 13:00 snapshots to 12:00
const { error } = await supabase
  .from('skill_snapshots')
  .update({ snapshot_at: '2026-01-30T12:00:00+00:00' })
  .eq('snapshot_at', '2026-01-30T13:00:00+00:00');

if (error) {
  console.error('Error:', error);
  process.exit(1);
}
console.log('✅ Updated snapshot_at from 13:00 to 12:00');

const { count } = await supabase
  .from('skill_snapshots')
  .select('*', { count: 'exact', head: true })
  .eq('snapshot_at', '2026-01-30T12:00:00+00:00');
console.log(`   Count: ${count} records`);
