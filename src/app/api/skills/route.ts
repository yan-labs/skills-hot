import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-middleware';

const SKILLSMP_API_URL = 'https://skillsmp.com/api/v1';
const SKILLSMP_API_KEY = process.env.SKILLSMP_API_KEY;

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

interface LocalSkill {
  id: string;
  name: string;
  slug: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  is_private: boolean;
  user_id: string;
  version: string;
  has_files: boolean;
  created_at: string;
  updated_at: string;
  skill_stats: { installs: number }[];
}

/**
 * GET /api/skills
 * Search skills from both local database and SkillSMP
 *
 * Query params:
 * - q: search query
 * - limit: max results (default 50)
 * - source: 'all' | 'local' | 'skillsmp' | 'my' (default 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const source = searchParams.get('source') || 'all';

    // Get current user if authenticated
    const authHeader = request.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    const currentUser = authResult.user;

    const results: Array<{
      id: string;
      name: string;
      slug: string;
      description: string;
      author: string;
      source: 'local' | 'skillsmp';
      is_private?: boolean;
      has_files?: boolean;
      version?: string;
      installs?: number;
      githubUrl?: string;
      skillUrl?: string;
      stars?: number;
    }> = [];

    // 1. Search local database (unless source is 'skillsmp')
    if (source !== 'skillsmp') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        let dbQuery = supabase
          .from('skills')
          .select('*, skill_stats(installs)');

        // Handle 'my' source - only user's skills (public + private)
        if (source === 'my') {
          if (!currentUser) {
            return NextResponse.json(
              { error: 'Authentication required for viewing your skills' },
              { status: 401 }
            );
          }
          dbQuery = dbQuery.eq('user_id', currentUser.id);
        } else {
          // For 'all' or 'local': show public skills + user's own private skills
          if (currentUser) {
            dbQuery = dbQuery.or(`is_private.eq.false,user_id.eq.${currentUser.id}`);
          } else {
            dbQuery = dbQuery.eq('is_private', false);
          }
        }

        // Apply search filter
        if (query) {
          dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
        }

        const { data: localSkills } = await dbQuery
          .order('created_at', { ascending: false })
          .limit(limit);

        if (localSkills) {
          for (const skill of localSkills as LocalSkill[]) {
            results.push({
              id: skill.id,
              name: skill.name,
              slug: skill.slug,
              description: skill.description || '',
              author: skill.author || '',
              source: 'local',
              is_private: skill.is_private,
              has_files: skill.has_files,
              version: skill.version,
              installs: skill.skill_stats?.[0]?.installs || 0,
            });
          }
        }
      }
    }

    // 2. Search SkillSMP (unless source is 'local' or 'my')
    if (source !== 'local' && source !== 'my' && SKILLSMP_API_KEY) {
      try {
        const skillsmpUrl = new URL(`${SKILLSMP_API_URL}/skills/search`);
        if (query) {
          skillsmpUrl.searchParams.set('q', query);
        }

        const response = await fetch(skillsmpUrl.toString(), {
          headers: {
            Authorization: `Bearer ${SKILLSMP_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.skills) {
            for (const skill of data.data.skills as SkillsmpSkill[]) {
              // Avoid duplicates (check by name)
              if (!results.find((r) => r.name === skill.name)) {
                results.push({
                  id: skill.id,
                  name: skill.name,
                  slug: skill.id,
                  description: skill.description || '',
                  author: skill.author || '',
                  source: 'skillsmp',
                  githubUrl: skill.githubUrl,
                  skillUrl: skill.skillUrl,
                  stars: skill.stars || 0,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('SkillSMP search error:', error);
        // Continue without SkillSMP results
      }
    }

    // Sort and limit
    const sortedResults = results.slice(0, limit);

    return NextResponse.json(sortedResults);
  } catch (error) {
    console.error('Skills API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
