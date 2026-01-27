/**
 * 本地全量同步 GitHub stars
 * 运行: npx tsx scripts/sync-all-stars.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 加载 .env.local
config({ path: '.env.local' });

const GITHUB_API = 'https://api.github.com';

async function fetchGitHubRepo(owner: string, repo: string): Promise<number | null> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SkillsHot/1.0',
        'Accept': 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`  ⚠️ Repo not found: ${owner}/${repo}`);
      } else if (response.status === 403) {
        console.log(`  ⚠️ Rate limited, waiting...`);
        await sleep(60000); // Wait 1 minute
        return fetchGitHubRepo(owner, repo); // Retry
      } else {
        console.log(`  ⚠️ GitHub API error ${response.status}: ${owner}/${repo}`);
      }
      return null;
    }

    const data = await response.json();
    return data.stargazers_count;
  } catch (error) {
    console.error(`  ❌ Error fetching ${owner}/${repo}:`, error);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.log('Please set these environment variables or create a .env.local file');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔄 Fetching all unique repos from external_skills...');

  // 获取所有唯一的仓库
  const { data: skills, error } = await supabase
    .from('external_skills')
    .select('repo')
    .not('repo', 'is', null);

  if (error) {
    console.error('❌ Failed to fetch skills:', error);
    process.exit(1);
  }

  // 获取唯一仓库列表
  const repoSet = new Set<string>();
  for (const skill of skills || []) {
    if (skill.repo) {
      repoSet.add(skill.repo);
    }
  }

  const repos = Array.from(repoSet);
  console.log(`📦 Found ${repos.length} unique repos to sync\n`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < repos.length; i++) {
    const repoFullName = repos[i];
    const [owner, repo] = repoFullName.split('/');

    process.stdout.write(`[${i + 1}/${repos.length}] ${repoFullName}... `);

    if (!owner || !repo) {
      console.log('⚠️ Invalid repo format');
      failed++;
      continue;
    }

    const stars = await fetchGitHubRepo(owner, repo);

    if (stars !== null) {
      // 更新数据库
      const { error: updateError } = await supabase
        .from('external_skills')
        .update({ stars, synced_at: new Date().toISOString() })
        .eq('repo', repoFullName);

      if (updateError) {
        console.log(`❌ DB error: ${updateError.message}`);
        failed++;
      } else {
        console.log(`✅ ${stars.toLocaleString()} stars`);
        updated++;
      }
    } else {
      failed++;
    }

    // Rate limiting: GitHub API allows 5000 requests/hour with auth, 60/hour without
    // With auth: ~1.4 req/sec safe, without: ~1 req/min
    if (process.env.GITHUB_TOKEN) {
      await sleep(200); // 200ms between requests with token
    } else {
      await sleep(1500); // 1.5s between requests without token
    }
  }

  console.log(`\n✨ Done! Updated: ${updated}, Failed: ${failed}`);
}

main().catch(console.error);
