import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-middleware';
import { fetchGitHubContent, getGitHubRawUrl, parseTopSource } from '@/lib/github-content';

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
 * 查询顺序:
 * 1. 本地 skills 表（从 content 字段）
 * 2. external_skills 表（从 raw_url 或构建 GitHub URL）
 * 3. SkillSMP + GitHub
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
      return new NextResponse('Database configuration missing', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Try local skills table first
    const { data: localSkill } = await supabase
      .from('skills')
      .select('id, content, is_private, user_id')
      .eq('slug', slug)
      .single();

    if (localSkill) {
      // Check access for private skills
      if (localSkill.is_private) {
        if (!currentUser) {
          return new NextResponse('Skill not found', { status: 404 });
        }

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
            return new NextResponse('Skill not found', { status: 404 });
          }
        }
      }

      if (localSkill.content) {
        return new NextResponse(localSkill.content, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        });
      }
    }

    // 2. Try external_skills table (优先 skills.sh 来源)
    const { data: externalSkills } = await supabase
      .from('external_skills')
      .select('raw_url, repo, repo_path, branch')
      .eq('slug', slug)
      .order('source', { ascending: false })
      .limit(1);

    const externalSkill = externalSkills?.[0];

    if (externalSkill) {
      let rawUrl = externalSkill.raw_url;

      // If no raw_url stored, construct it from repo info
      if (!rawUrl && externalSkill.repo) {
        const { owner, repo } = parseTopSource(externalSkill.repo);
        rawUrl = getGitHubRawUrl(owner, repo, externalSkill.branch || 'main', externalSkill.repo_path);
      }

      if (rawUrl) {
        const content = await fetchGitHubContent(rawUrl);
        return new NextResponse(content, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        });
      }
    }

    // 2.5 Also try by name in external_skills
    const { data: externalByNames } = await supabase
      .from('external_skills')
      .select('raw_url, repo, repo_path, branch')
      .eq('name', slug)
      .order('source', { ascending: false })
      .limit(1);

    const externalByName = externalByNames?.[0];

    if (externalByName) {
      let rawUrl = externalByName.raw_url;

      if (!rawUrl && externalByName.repo) {
        const { owner, repo } = parseTopSource(externalByName.repo);
        rawUrl = getGitHubRawUrl(owner, repo, externalByName.branch || 'main', externalByName.repo_path);
      }

      if (rawUrl) {
        const content = await fetchGitHubContent(rawUrl);
        return new NextResponse(content, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        });
      }
    }

    // 3. Fall back to SkillSMP + GitHub
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

    // Fetch from GitHub with caching
    const content = await fetchGitHubContent(rawUrl);

    // If content unavailable, try alternative file names
    if (content.includes('Content Unavailable')) {
      const altUrls = [
        rawUrl.replace('/SKILL.md', '/skill.md'),
        rawUrl.replace('/SKILL.md', '/README.md'),
      ];

      for (const altUrl of altUrls) {
        const altContent = await fetchGitHubContent(altUrl);
        if (!altContent.includes('Content Unavailable')) {
          return new NextResponse(altContent, {
            headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
          });
        }
      }
    }

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
      // Try simple format: https://github.com/{owner}/{repo}
      const simpleMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (simpleMatch) {
        const [, owner, repo] = simpleMatch;
        return `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`;
      }
      return null;
    }

    const [, owner, repo, branch, path] = match;

    // Build raw.githubusercontent.com URL
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}/SKILL.md`;
  } catch {
    return null;
  }
}
