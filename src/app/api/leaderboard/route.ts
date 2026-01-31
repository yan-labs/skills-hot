import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'config_error', message: 'Missing Supabase configuration' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const sortBy = searchParams.get('sortBy') || 'installs';
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('external_skills')
    .select('name, slug, github_owner, installs, stars')
    .order(sortBy, { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json(
      { error: 'db_error', message: 'Failed to fetch leaderboard data' },
      { status: 500 }
    );
  }

  const skills = (data || []).map((s) => ({
    name: s.name,
    slug: s.slug,
    author: s.github_owner,
    installs: s.installs || 0,
    stars: s.stars || 0,
  }));

  return NextResponse.json({
    skills,
    nextOffset: offset + PAGE_SIZE,
    hasMore: data?.length === PAGE_SIZE,
  });
}
