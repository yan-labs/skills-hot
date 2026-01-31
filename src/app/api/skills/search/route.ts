import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const PAGE_SIZE = 20;

type SearchType = 'skills' | 'authors' | 'repos';

type SkillResult = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  author: string | null;
  category: string | null;
  tags: string[] | null;
  platforms: string[] | null;
  installs: number;
  source: 'local' | 'external';
};

type AuthorResult = {
  id: string;
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  external_skill_count: number;
  total_installs: number;
  total_stars: number;
};

type RepoResult = {
  repo: string;
  skill_count: number;
  total_installs: number;
  skills: { name: string; slug: string }[];
};

// Check if skill explicitly supports the platform (not just universal)
function hasExplicitPlatformSupport(platforms: string[] | null, platform: string): boolean {
  if (!platforms || platforms.length === 0) return false;
  return platforms.includes(platform);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const platform = searchParams.get('platform') || '';
  const searchType = (searchParams.get('type') as SearchType) || 'skills';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const offset = (page - 1) * PAGE_SIZE;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Handle different search types
    if (searchType === 'authors') {
      return await searchAuthors(supabase, query, page, offset);
    }

    if (searchType === 'repos') {
      return await searchRepos(supabase, query, page, offset);
    }

    // Default: search skills
    return await searchSkills(supabase, query, platform, page, offset);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

async function searchSkills(
  supabase: ReturnType<typeof createClient>,
  query: string,
  platform: string,
  page: number,
  offset: number
) {
  const results: SkillResult[] = [];

  // 1. Search local skills
  let localQuery = supabase
    .from('skills')
    .select('id, name, slug, description, author, category, tags, platforms, skill_stats(installs)')
    .eq('is_private', false);

  if (query) {
    localQuery = localQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  }

  if (platform && platform !== 'all') {
    localQuery = localQuery.or(`platforms.cs.{"${platform}"},platforms.cs.{universal}`);
  }

  const { data: localData, error: localError } = await localQuery;

  if (localError) {
    console.error('Error searching local skills:', localError);
  } else if (localData) {
    for (const skill of localData) {
      results.push({
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        author: skill.author,
        category: skill.category,
        tags: skill.tags,
        platforms: skill.platforms,
        installs: skill.skill_stats?.[0]?.installs || 0,
        source: 'local',
      });
    }
  }

  // 2. Search external skills
  let externalQuery = supabase
    .from('external_skills')
    .select('id, name, slug, description, github_owner, installs, platforms');

  if (query) {
    externalQuery = externalQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  }

  if (platform && platform !== 'all') {
    externalQuery = externalQuery.or(`platforms.cs.{"${platform}"},platforms.cs.{universal}`);
  }

  const { data: externalData, error: externalError } = await externalQuery;

  if (externalError) {
    console.error('Error searching external skills:', externalError);
  } else if (externalData) {
    for (const skill of externalData) {
      results.push({
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        author: skill.github_owner,
        category: null,
        tags: null,
        platforms: skill.platforms,
        installs: skill.installs || 0,
        source: 'external',
      });
    }
  }

  // Deduplicate by slug
  const seenSlugs = new Set<string>();
  let dedupedResults: SkillResult[] = [];

  results.sort((a, b) => b.installs - a.installs);

  for (const result of results) {
    if (!seenSlugs.has(result.slug)) {
      seenSlugs.add(result.slug);
      dedupedResults.push(result);
    }
  }

  // Sort: when filtering by platform, prioritize explicit platform support
  if (platform && platform !== 'all') {
    dedupedResults.sort((a, b) => {
      const aExplicit = hasExplicitPlatformSupport(a.platforms, platform);
      const bExplicit = hasExplicitPlatformSupport(b.platforms, platform);

      if (aExplicit && !bExplicit) return -1;
      if (!aExplicit && bExplicit) return 1;

      return b.installs - a.installs;
    });
  }

  const total = dedupedResults.length;
  const paginatedResults = dedupedResults.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + PAGE_SIZE < total;

  return NextResponse.json({
    type: 'skills',
    results: paginatedResults,
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore,
  });
}

async function searchAuthors(
  supabase: ReturnType<typeof createClient>,
  query: string,
  page: number,
  offset: number
) {
  let authorsQuery = supabase
    .from('authors')
    .select('id, github_login, name, avatar_url, external_skill_count, total_installs, total_stars')
    .gt('external_skill_count', 0);

  if (query) {
    authorsQuery = authorsQuery.or(`github_login.ilike.%${query}%,name.ilike.%${query}%`);
  }

  authorsQuery = authorsQuery.order('total_installs', { ascending: false });

  const { data, error, count } = await authorsQuery;

  if (error) {
    console.error('Error searching authors:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  const results: AuthorResult[] = (data || []).map((author) => ({
    id: author.id,
    github_login: author.github_login,
    name: author.name,
    avatar_url: author.avatar_url,
    external_skill_count: author.external_skill_count || 0,
    total_installs: author.total_installs || 0,
    total_stars: author.total_stars || 0,
  }));

  const total = results.length;
  const paginatedResults = results.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + PAGE_SIZE < total;

  return NextResponse.json({
    type: 'authors',
    results: paginatedResults,
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore,
  });
}

async function searchRepos(
  supabase: ReturnType<typeof createClient>,
  query: string,
  page: number,
  offset: number
) {
  let reposQuery = supabase
    .from('external_skills')
    .select('repo, name, slug, installs');

  if (query) {
    reposQuery = reposQuery.ilike('repo', `%${query}%`);
  }

  const { data, error } = await reposQuery.order('installs', { ascending: false });

  if (error) {
    console.error('Error searching repos:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  // Group by repo
  const repoMap = new Map<string, RepoResult>();

  for (const skill of data || []) {
    if (!skill.repo) continue;

    if (!repoMap.has(skill.repo)) {
      repoMap.set(skill.repo, {
        repo: skill.repo,
        skill_count: 0,
        total_installs: 0,
        skills: [],
      });
    }

    const repo = repoMap.get(skill.repo)!;
    repo.skill_count++;
    repo.total_installs += skill.installs || 0;
    if (repo.skills.length < 3) {
      repo.skills.push({ name: skill.name, slug: skill.slug });
    }
  }

  const results = Array.from(repoMap.values()).sort(
    (a, b) => b.total_installs - a.total_installs
  );

  const total = results.length;
  const paginatedResults = results.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + PAGE_SIZE < total;

  return NextResponse.json({
    type: 'repos',
    results: paginatedResults,
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore,
  });
}
