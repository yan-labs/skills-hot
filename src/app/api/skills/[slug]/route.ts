import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-middleware';

const SKILLSMP_API_URL = 'https://skillsmp.com/api/v1';
const SKILLSMP_API_KEY = process.env.SKILLSMP_API_KEY;

type Props = {
  params: Promise<{ slug: string }>;
};

interface SkillsmpSkill {
  id: string;
  name: string;
  author: string;
  description: string;
  githubUrl: string;
  skillUrl: string;
  stars?: number;
  updatedAt?: number;
}

/**
 * GET /api/skills/[slug]
 * Get skill details by slug
 * Checks local database first, then falls back to SkillSMP
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { slug } = await params;

    // Get current user if authenticated
    const authHeader = request.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    const currentUser = authResult.user;

    // 1. Try local database first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: skill } = await supabase
        .from('skills')
        .select('*, skill_stats(installs, views)')
        .eq('slug', slug)
        .single();

      if (skill) {
        // Check access for private skills
        if (skill.is_private) {
          if (!currentUser) {
            return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
          }

          // Check if user is owner
          if (skill.user_id !== currentUser.id) {
            // Check skill_access table
            const { data: access } = await supabase
              .from('skill_access')
              .select('id')
              .eq('skill_id', skill.id)
              .eq('user_id', currentUser.id)
              .or('expires_at.is.null,expires_at.gt.now()')
              .single();

            if (!access) {
              return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
            }
          }
        }

        return NextResponse.json({
          id: skill.id,
          name: skill.name,
          slug: skill.slug,
          description: skill.description,
          author: skill.author,
          category: skill.category,
          tags: skill.tags,
          version: skill.version,
          has_files: skill.has_files,
          is_private: skill.is_private,
          source: 'local',
          installs: skill.skill_stats?.installs || 0,
          views: skill.skill_stats?.views || 0,
          created_at: skill.created_at,
          updated_at: skill.updated_at,
        });
      }
    }

    // 2. Fall back to SkillSMP
    if (!SKILLSMP_API_KEY) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const searchUrl = new URL(`${SKILLSMP_API_URL}/skills/search`);
    searchUrl.searchParams.set('q', slug);

    const response = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${SKILLSMP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const data = await response.json();

    if (!data.success || !data.data?.skills?.length) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Find matching skill
    const skill =
      data.data.skills.find((s: SkillsmpSkill) => s.id === slug || s.name === slug) ||
      data.data.skills[0];

    return NextResponse.json({
      id: skill.id,
      name: skill.name,
      slug: skill.id,
      description: skill.description,
      author: skill.author,
      source: 'skillsmp',
      githubUrl: skill.githubUrl,
      skillUrl: skill.skillUrl,
      stars: skill.stars || 0,
      updatedAt: skill.updatedAt,
    });
  } catch (error) {
    console.error('Skill API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
