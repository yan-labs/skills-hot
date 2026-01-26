import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-middleware';
import type { SkillDetail } from '@/lib/supabase';

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/skills/[slug]
 * Get skill details by slug
 * 查询顺序: 1. 本地 skills 表 → 2. external_skills 表 (by slug) → 3. external_skills 表 (by name)
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { slug } = await params;

    // Get current user if authenticated
    const authHeader = request.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    const currentUser = authResult.user;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Try local skills table first
    const { data: localSkill } = await supabase
      .from('skills')
      .select('*, skill_stats(installs, views)')
      .eq('slug', slug)
      .single();

    if (localSkill) {
      // Check access for private skills
      if (localSkill.is_private) {
        if (!currentUser) {
          return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
        }

        // Check if user is owner
        if (localSkill.user_id !== currentUser.id) {
          // Check skill_access table
          const { data: access } = await supabase
            .from('skill_access')
            .select('id')
            .eq('skill_id', localSkill.id)
            .eq('user_id', currentUser.id)
            .or('expires_at.is.null,expires_at.gt.now()')
            .single();

          if (!access) {
            return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
          }
        }
      }

      const response: SkillDetail = {
        id: localSkill.id,
        name: localSkill.name,
        slug: localSkill.slug,
        description: localSkill.description,
        author: localSkill.author,
        category: localSkill.category,
        tags: localSkill.tags,
        source: 'local',
        contentSource: 'database',
        installs: localSkill.skill_stats?.installs || 0,
        views: localSkill.skill_stats?.views || 0,
        version: localSkill.version,
        has_files: localSkill.has_files,
        is_private: localSkill.is_private,
        author_info: localSkill.author || null,
        created_at: localSkill.created_at,
        updated_at: localSkill.updated_at,
      };

      return NextResponse.json(response);
    }

    // 2. Try external_skills table
    const { data: externalSkill } = await supabase
      .from('external_skills')
      .select('*, author:authors(*)')
      .eq('slug', slug)
      .single();

    if (externalSkill) {
      const response: SkillDetail = {
        id: externalSkill.id,
        name: externalSkill.name,
        slug: externalSkill.slug,
        description: externalSkill.description,
        author: externalSkill.github_owner,
        category: null,
        tags: null,
        source: 'github',
        contentSource: 'github',
        installs: externalSkill.installs,
        stars: externalSkill.stars,
        repo: externalSkill.repo,
        repo_path: externalSkill.repo_path,
        raw_url: externalSkill.raw_url,
        github_owner: externalSkill.github_owner,
        author_info: externalSkill.author || null,
        created_at: externalSkill.created_at,
        updated_at: externalSkill.updated_at,
      };

      return NextResponse.json(response);
    }

    // 3. Also try to match by name in external_skills
    const { data: externalByName } = await supabase
      .from('external_skills')
      .select('*, author:authors(*)')
      .eq('name', slug)
      .single();

    if (externalByName) {
      const response: SkillDetail = {
        id: externalByName.id,
        name: externalByName.name,
        slug: externalByName.slug,
        description: externalByName.description,
        author: externalByName.github_owner,
        category: null,
        tags: null,
        source: 'github',
        contentSource: 'github',
        installs: externalByName.installs,
        stars: externalByName.stars,
        repo: externalByName.repo,
        repo_path: externalByName.repo_path,
        raw_url: externalByName.raw_url,
        github_owner: externalByName.github_owner,
        author_info: externalByName.author || null,
        created_at: externalByName.created_at,
        updated_at: externalByName.updated_at,
      };

      return NextResponse.json(response);
    }

    // 4. Not found
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  } catch (error) {
    console.error('Skill API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
