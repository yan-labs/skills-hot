import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchGitHubUser, generateSlug, getGitHubRawUrl, parseTopSource } from '@/lib/github-content';

type SkillsShSkill = {
  name: string;
  installs?: number;
  topSource?: string;
};

type SkillsShResponse = {
  skills?: SkillsShSkill[];
};

const DEFAULT_SKILLS_SH_URL = 'https://skills.sh/api/openskills';

export async function GET(request: Request) {
  // Validate request source: Cloudflare Cron or CRON_SECRET (if configured).
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent') || '';
  const isCloudflareWorker = userAgent.includes('Cloudflare-Cron');

  if (
    !isCloudflareWorker &&
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const skillsShUrl = process.env.SKILLS_SH_API_URL || DEFAULT_SKILLS_SH_URL;
    const response = await fetch(skillsShUrl, { cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json(
        { error: `skills.sh API error: ${response.status}` },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as SkillsShResponse;
    if (!payload || !Array.isArray(payload.skills)) {
      return NextResponse.json(
        { error: 'Invalid response from skills.sh' },
        { status: 502 }
      );
    }

    const skills = payload.skills;
    const syncedAt = new Date().toISOString();

    // Cache installs data for search enhancement
    await supabase.from('skills_sh_cache').upsert(
      skills.map((s) => ({
        name: s.name,
        installs: s.installs ?? 0,
        top_source: s.topSource ?? null,
        synced_at: syncedAt,
      })),
      { onConflict: 'name' }
    );

    const skillsWithSource = skills.filter(
      (s) => typeof s.topSource === 'string' && s.topSource.trim().length > 0
    );

    // Resolve authors by GitHub login
    const ownerSet = new Set<string>();
    for (const skill of skillsWithSource) {
      const { owner } = parseTopSource(skill.topSource!.trim());
      if (owner) ownerSet.add(owner);
    }
    const owners = [...ownerSet];

    const ownerToAuthorId = new Map<string, string>();

    if (owners.length > 0) {
      const { data: existingAuthors } = await supabase
        .from('authors')
        .select('id, github_login')
        .in('github_login', owners);

      for (const author of existingAuthors || []) {
        ownerToAuthorId.set(author.github_login, author.id);
      }

      const missingOwners = owners.filter((o) => !ownerToAuthorId.has(o));
      if (missingOwners.length > 0) {
        const newAuthorRows = [];
        for (const login of missingOwners) {
          const ghUser = await fetchGitHubUser(login);
          if (!ghUser) continue;
          newAuthorRows.push({
            github_id: ghUser.id,
            github_login: ghUser.login,
            name: ghUser.name,
            avatar_url: ghUser.avatar_url,
            bio: ghUser.bio,
          });
        }

        if (newAuthorRows.length > 0) {
          const { data: insertedAuthors } = await supabase
            .from('authors')
            .upsert(newAuthorRows, { onConflict: 'github_id' })
            .select('id, github_login');

          for (const author of insertedAuthors || []) {
            ownerToAuthorId.set(author.github_login, author.id);
          }
        }
      }
    }

    // Upsert external skills metadata
    const externalRows = [];
    const authorIdsToUpdate = new Set<string>();

    for (const skill of skillsWithSource) {
      const topSource = skill.topSource!.trim();
      const { owner, repo, path } = parseTopSource(topSource);
      if (!owner || !repo) continue;

      const authorId = ownerToAuthorId.get(owner) ?? null;
      if (authorId) authorIdsToUpdate.add(authorId);

      externalRows.push({
        source: 'skills.sh',
        source_id: skill.name,
        name: skill.name,
        slug: generateSlug(skill.name),
        repo: `${owner}/${repo}`,
        repo_path: path,
        branch: 'main',
        raw_url: getGitHubRawUrl(owner, repo, 'main', path),
        author_id: authorId,
        github_owner: owner,
        installs: skill.installs ?? 0,
        synced_at: syncedAt,
        verified: false,
      });
    }

    if (externalRows.length > 0) {
      await supabase
        .from('external_skills')
        .upsert(externalRows, { onConflict: 'source,source_id' });
    }

    await Promise.all(
      [...authorIdsToUpdate].map((id) =>
        supabase.rpc('update_author_stats', { p_author_id: id })
      )
    );

    return NextResponse.json({
      success: true,
      total: skills.length,
      processed: skillsWithSource.length,
      syncedAt,
    });
  } catch (error) {
    console.error('Sync external skills error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

