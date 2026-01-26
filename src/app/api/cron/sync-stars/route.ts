import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchGitHubRepo } from '@/lib/github-content';

/**
 * GET /api/cron/sync-stars
 * 专门用于同步 GitHub stars 到 external_skills 表
 * 设计为在 Cloudflare Workers subrequest 限制内运行
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
    // 1. 获取 top 30 skills by installs
    const { data: topSkills, error: fetchError } = await supabase
      .from('external_skills')
      .select('id, name, repo, stars')
      .order('installs', { ascending: false })
      .limit(30);

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch skills', details: fetchError },
        { status: 500 }
      );
    }

    if (!topSkills || topSkills.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No skills found in database',
        skillsCount: topSkills?.length || 0,
      });
    }

    // 2. 获取唯一的仓库列表 (最多 20 个以避免 Cloudflare subrequest 限制)
    const repoSet = new Set<string>();
    for (const skill of topSkills) {
      if (skill.repo) {
        repoSet.add(skill.repo);
        if (repoSet.size >= 20) break;
      }
    }

    if (repoSet.size === 0) {
      return NextResponse.json({
        success: false,
        error: 'No repos found in skills',
      });
    }

    // 3. 串行获取每个仓库的 stars
    const repoStars: Array<{ repo: string; stars: number }> = [];
    const repoList = Array.from(repoSet);

    for (const repoFullName of repoList) {
      const [owner, repo] = repoFullName.split('/');
      if (owner && repo) {
        const repoInfo = await fetchGitHubRepo(owner, repo);
        if (repoInfo) {
          repoStars.push({
            repo: repoFullName,
            stars: repoInfo.stargazers_count,
          });
        }
      }
    }

    // 4. 批量更新 stars (单个 upsert 调用)
    let updated = 0;
    for (const { repo, stars } of repoStars) {
      const { error } = await supabase
        .from('external_skills')
        .update({ stars, synced_at: new Date().toISOString() })
        .eq('repo', repo);

      if (!error) {
        updated++;
      }
    }

    return NextResponse.json({
      success: true,
      reposChecked: repoStars.length,
      updated,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync stars error:', error);
    return NextResponse.json(
      { error: 'Failed to sync stars' },
      { status: 500 }
    );
  }
}
