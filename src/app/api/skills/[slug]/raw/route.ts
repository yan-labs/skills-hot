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
 * GET /api/skills/[slug]/raw
 * Get raw SKILL.md content
 * - Local skills: from database content field
 * - SkillSMP skills: from GitHub
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
        .select('id, content, is_private, user_id')
        .eq('slug', slug)
        .single();

      if (skill) {
        // Check access for private skills
        if (skill.is_private) {
          if (!currentUser) {
            return new NextResponse('Skill not found', { status: 404 });
          }

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
              return new NextResponse('Skill not found', { status: 404 });
            }
          }
        }

        if (skill.content) {
          return new NextResponse(skill.content, {
            headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
          });
        }
      }
    }

    // 2. Fall back to SkillSMP + GitHub
    if (!SKILLSMP_API_KEY) {
      return new NextResponse('Skill not found', { status: 404 });
    }

    // Get skill info from SkillSMP
    const searchUrl = new URL(`${SKILLSMP_API_URL}/skills/search`);
    searchUrl.searchParams.set('q', slug);

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${SKILLSMP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      return new NextResponse('Skill not found', { status: 404 });
    }

    const data = await searchResponse.json();

    if (!data.success || !data.data?.skills?.length) {
      return new NextResponse('Skill not found', { status: 404 });
    }

    const skill = data.data.skills.find(
      (s: SkillsmpSkill) => s.id === slug || s.name === slug
    ) || data.data.skills[0];

    if (!skill.githubUrl) {
      return new NextResponse('Skill content not available', { status: 404 });
    }

    // Convert GitHub URL to raw content URL
    const rawUrl = convertToRawGitHubUrl(skill.githubUrl);

    if (!rawUrl) {
      return new NextResponse('Unable to fetch skill content', { status: 404 });
    }

    // Fetch from GitHub
    const contentResponse = await fetch(rawUrl);

    if (!contentResponse.ok) {
      // Try alternative file names
      const altUrls = [
        rawUrl.replace('/SKILL.md', '/skill.md'),
        rawUrl.replace('/SKILL.md', '/README.md'),
      ];

      for (const altUrl of altUrls) {
        const altResponse = await fetch(altUrl);
        if (altResponse.ok) {
          const content = await altResponse.text();
          return new NextResponse(content, {
            headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
          });
        }
      }

      return new NextResponse('Skill content not found', { status: 404 });
    }

    const content = await contentResponse.text();

    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  } catch (error) {
    console.error('Skill raw API error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

function convertToRawGitHubUrl(githubUrl: string): string | null {
  try {
    // Parse GitHub URL
    // Format: https://github.com/{owner}/{repo}/tree/{branch}/{path}
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+)/);

    if (!match) {
      return null;
    }

    const [, owner, repo, branch, path] = match;

    // Build raw.githubusercontent.com URL
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}/SKILL.md`;
  } catch {
    return null;
  }
}
