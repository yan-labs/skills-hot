import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDB() {
  // Check external_skills count
  const { count: externalCount } = await supabase
    .from('external_skills')
    .select('*', { count: 'exact', head: true });

  // Check authors count
  const { count: authorsCount } = await supabase
    .from('authors')
    .select('*', { count: 'exact', head: true });

  // Check skills_sh_cache count
  const { count: cacheCount } = await supabase
    .from('skills_sh_cache')
    .select('*', { count: 'exact', head: true });

  // Check native skills count
  const { count: skillsCount } = await supabase
    .from('skills')
    .select('*', { count: 'exact', head: true });

  // Get latest sync time
  const { data: latestSync } = await supabase
    .from('external_skills')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  console.log('=== Skills Hot Database Status ===');
  console.log('external_skills:', externalCount);
  console.log('authors:', authorsCount);
  console.log('skills_sh_cache:', cacheCount);
  console.log('native skills:', skillsCount);
  console.log('last sync:', latestSync ? latestSync.synced_at : 'never');
}

checkDB();
