import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseTopSource, getGitHubRawUrl, fetchGitHubUser, fetchGitHubRepo, generateSlug } from '@/lib/github-content';

const SKILLS_SH_API = 'https://skills.sh/api/skills?limit=50000';

interface SkillsShSkill {
  id: string;
  name: string;
  installs: number;
  topSource: string;
}

/**
 * GET /api/cron/sync-external-skills
 * 同步 skills.sh 数据到 external_skills 表
 * 同时处理作者信息
 */
export async function GET(request: Request) {
  // 验证 Cron 密钥
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. 拉取 skills.sh 全量数据
    const response = await fetch(SKILLS_SH_API, {
      headers: {
        'User-Agent': 'SkillBank/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `skills.sh API error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!data.skills || !Array.isArray(data.skills)) {
      return NextResponse.json(
        { error: 'Invalid response from skills.sh' },
        { status: 502 }
      );
    }

    // 2. 收集所有唯一的 GitHub owners
    const ownerSet = new Set<string>();
    const skillsWithParsedSource: Array<SkillsShSkill & { parsed: ReturnType<typeof parseTopSource> }> = [];

    for (const skill of data.skills as SkillsShSkill[]) {
      if (!skill.topSource) continue;

      const parsed = parseTopSource(skill.topSource);
      if (parsed.owner && parsed.repo) {
        ownerSet.add(parsed.owner);
        skillsWithParsedSource.push({ ...skill, parsed });
      }
    }

    // 3. 确保所有 authors 存在
    const authorMap = new Map<string, string>(); // github_login -> author_id

    // 获取已存在的 authors
    const { data: existingAuthors } = await supabase
      .from('authors')
      .select('id, github_login')
      .in('github_login', Array.from(ownerSet));

    if (existingAuthors) {
      for (const author of existingAuthors) {
        authorMap.set(author.github_login, author.id);
      }
    }

    // 创建缺失的 authors（批量处理，避免 API 限制）
    const missingOwners = Array.from(ownerSet).filter(owner => !authorMap.has(owner));
    const newAuthors: Array<{
      github_id: number;
      github_login: string;
      name: string | null;
      avatar_url: string | null;
      bio: string | null;
    }> = [];

    // 限制并发请求数
    const batchSize = 10;
    for (let i = 0; i < missingOwners.length; i += batchSize) {
      const batch = missingOwners.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async owner => {
          const userInfo = await fetchGitHubUser(owner);
          if (userInfo) {
            return {
              github_id: userInfo.id,
              github_login: userInfo.login,
              name: userInfo.name,
              avatar_url: userInfo.avatar_url,
              bio: userInfo.bio,
            };
          }
          // 如果获取失败，创建占位记录
          return {
            github_id: Math.floor(Math.random() * 1000000000), // 临时 ID
            github_login: owner,
            name: null,
            avatar_url: null,
            bio: null,
          };
        })
      );
      newAuthors.push(...results.filter(Boolean));
    }

    // 批量插入新 authors
    if (newAuthors.length > 0) {
      const { data: insertedAuthors, error: authorsError } = await supabase
        .from('authors')
        .upsert(newAuthors, { onConflict: 'github_id', ignoreDuplicates: false })
        .select('id, github_login');

      if (authorsError) {
        console.error('Authors upsert error:', authorsError);
      } else if (insertedAuthors) {
        for (const author of insertedAuthors) {
          authorMap.set(author.github_login, author.id);
        }
      }
    }

    // 4. 获取热门仓库的 stars（只获取 top 15 by installs 的仓库，避免 Cloudflare subrequest 限制）
    // Cloudflare Workers 免费版限制 50 subrequests，付费版 1000
    const sortedSkills = [...skillsWithParsedSource].sort((a, b) => (b.installs || 0) - (a.installs || 0));
    const topRepoSet = new Set<string>();
    for (const skill of sortedSkills) {
      const { owner, repo } = skill.parsed;
      if (owner && repo) {
        topRepoSet.add(`${owner}/${repo}`);
        if (topRepoSet.size >= 15) break; // 限制 15 个仓库，留出 subrequest 配额给 Supabase
      }
    }

    const repoStarsMap = new Map<string, number>(); // "owner/repo" -> stars

    // 获取仓库 stars（串行以减少并发 subrequest）
    for (const repoFullName of topRepoSet) {
      const [owner, repo] = repoFullName.split('/');
      const repoInfo = await fetchGitHubRepo(owner, repo);
      repoStarsMap.set(repoFullName, repoInfo?.stargazers_count || 0);
    }

    // 5. 批量 upsert external_skills
    const externalSkillsBatch = 5000;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < skillsWithParsedSource.length; i += externalSkillsBatch) {
      const batch = skillsWithParsedSource.slice(i, i + externalSkillsBatch);

      const records = batch.map(skill => {
        const { owner, repo, path } = skill.parsed;
        const authorId = authorMap.get(owner) || null;
        const repoFullName = `${owner}/${repo}`;
        const stars = repoStarsMap.get(repoFullName) || 0;

        // 如果 topSource 没有 path，用 skill name 作为 path（monorepo 结构）
        const effectivePath = path || skill.name;
        const rawUrl = getGitHubRawUrl(owner, repo, 'main', effectivePath);

        return {
          source: 'github',
          source_id: skill.name,
          name: skill.name,
          slug: generateSlug(skill.name),
          repo: `${owner}/${repo}`,
          repo_path: effectivePath,
          branch: 'main',
          raw_url: rawUrl,
          author_id: authorId,
          github_owner: owner,
          installs: skill.installs || 0,
          stars,
          synced_at: new Date().toISOString(),
        };
      });

      const { error, count } = await supabase
        .from('external_skills')
        .upsert(records, { onConflict: 'source,source_id', ignoreDuplicates: false, count: 'exact' });

      if (error) {
        console.error('External skills upsert error:', error);
        errors++;
      } else {
        inserted += count || records.length;
      }
    }

    // 6. 更新 skills_sh_cache 表（保持向后兼容）
    const cacheRecords = data.skills.map((s: SkillsShSkill) => ({
      name: s.name,
      installs: s.installs || 0,
      top_source: s.topSource || null,
      synced_at: new Date().toISOString(),
    }));

    const cacheBatchSize = 1000;
    for (let i = 0; i < cacheRecords.length; i += cacheBatchSize) {
      const batch = cacheRecords.slice(i, i + cacheBatchSize);
      await supabase
        .from('skills_sh_cache')
        .upsert(batch, { onConflict: 'name' });
    }

    // 7. 更新作者统计
    const uniqueAuthorIds = Array.from(new Set(Array.from(authorMap.values())));
    for (const authorId of uniqueAuthorIds) {
      await supabase.rpc('update_author_stats', { p_author_id: authorId });
    }

    return NextResponse.json({
      success: true,
      total: data.skills.length,
      processed: skillsWithParsedSource.length,
      inserted,
      errors,
      newAuthors: newAuthors.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync external skills' },
      { status: 500 }
    );
  }
}
