import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Props = {
  params: Promise<{ login: string }>;
};

/**
 * GET /api/authors/[login]
 * Get author details and their skills
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { login } = await params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get author
    const { data: author, error } = await supabase
      .from('authors')
      .select('*')
      .eq('github_login', login)
      .single();

    if (error || !author) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 });
    }

    // Get external skills
    const { data: externalSkills } = await supabase
      .from('external_skills')
      .select('id, name, slug, description, installs, stars, repo')
      .eq('author_id', author.id)
      .order('installs', { ascending: false });

    // Get native skills (public only)
    const { data: nativeSkills } = await supabase
      .from('skills')
      .select('id, name, slug, description, version')
      .eq('author_id', author.id)
      .eq('is_private', false);

    return NextResponse.json({
      id: author.id,
      github_id: author.github_id,
      github_login: author.github_login,
      name: author.name,
      avatar_url: author.avatar_url,
      bio: author.bio,
      external_skill_count: author.external_skill_count,
      native_skill_count: author.native_skill_count,
      total_installs: author.total_installs,
      external_skills: externalSkills || [],
      native_skills: nativeSkills || [],
      created_at: author.created_at,
    });
  } catch (error) {
    console.error('Author API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
