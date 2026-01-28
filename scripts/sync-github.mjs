#!/usr/bin/env node
/**
 * GitHub 数据同步脚本 (GraphQL)
 *
 * 用法: node scripts/sync-github.mjs
 *
 * 功能:
 * - 从 Supabase 获取所有唯一仓库
 * - 使用 GraphQL API 批量获取仓库信息
 * - 更新 external_skills 表的 GitHub 数据
 *
 * 环境变量:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - GITHUB_TOKEN
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 需要设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

if (!GITHUB_TOKEN) {
  console.error('❌ 需要设置 GITHUB_TOKEN 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BATCH_SIZE = 50;

// 构建批量查询
function buildQuery(repos) {
  const repoQueries = repos.map((repo, i) => {
    const [owner, name] = repo.split('/');
    return `repo_${i}: repository(owner: "${owner}", name: "${name}") {
      nameWithOwner
      stargazerCount
      forkCount
      pushedAt
      createdAt
      updatedAt
      description
      homepageUrl
      isArchived
      isFork
      defaultBranchRef { name }
      licenseInfo { name spdxId }
      primaryLanguage { name color }
      repositoryTopics(first: 10) {
        nodes { topic { name } }
      }
      openIssues: issues(states: OPEN) { totalCount }
      watchers { totalCount }
      releases { totalCount }
      owner {
        login
        avatarUrl
        ... on User { id name bio }
        ... on Organization { id name description }
      }
    }`;
  });

  return 'query { ' + repoQueries.join('\n') + ' rateLimit { limit cost remaining resetAt } }';
}

// 执行查询（带重试）
async function fetchGraphQL(query, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      const text = await response.text();

      if (text.startsWith('<')) {
        throw new Error('Received HTML instead of JSON');
      }

      return JSON.parse(text);
    } catch (err) {
      if (attempt < retries) {
        console.log(`  重试 ${attempt}/${retries - 1}: ${err.message}`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        throw err;
      }
    }
  }
}

// 从 Supabase 获取所有唯一仓库
async function getUniqueRepos() {
  console.log('📦 获取仓库列表...');

  const allRepos = new Set();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('external_skills')
      .select('repo')
      .not('repo', 'is', null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('查询错误:', error);
      return [];
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.repo) allRepos.add(row.repo);
    }

    offset += pageSize;
    if (data.length < pageSize) break;
  }

  return Array.from(allRepos);
}

// 批量同步
async function syncAllRepos(repos) {
  const results = new Map();
  let totalCost = 0;
  let successCount = 0;
  let failCount = 0;

  const totalBatches = Math.ceil(repos.length / BATCH_SIZE);

  for (let i = 0; i < repos.length; i += BATCH_SIZE) {
    const batch = repos.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    process.stdout.write(`\r[${batchNum}/${totalBatches}] 获取中...`);

    try {
      const query = buildQuery(batch);
      const result = await fetchGraphQL(query);

      if (result.errors) {
        console.log(`\n⚠️ Batch ${batchNum} 有错误:`, result.errors[0]?.message);
      }

      if (result.data) {
        totalCost += result.data.rateLimit?.cost || 1;

        for (const [key, value] of Object.entries(result.data)) {
          if (key !== 'rateLimit' && value !== null) {
            results.set(value.nameWithOwner, value);
            successCount++;
          } else if (key !== 'rateLimit' && value === null) {
            failCount++;
          }
        }
      }
    } catch (err) {
      console.log(`\n❌ Batch ${batchNum} 失败:`, err.message);
      failCount += batch.length;
    }

    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n✅ 获取完成: ${successCount} 成功, ${failCount} 失败, 消耗 ${totalCost} 点`);
  return results;
}

// 更新数据库
async function updateDatabase(repoData) {
  console.log('\n📝 更新数据库...');

  let updated = 0;
  let failed = 0;
  const entries = Array.from(repoData.entries());

  for (let i = 0; i < entries.length; i++) {
    const [repoName, data] = entries[i];

    if (i % 100 === 0) {
      process.stdout.write(`\r[${i}/${entries.length}] 更新中...`);
    }

    const updateData = {
      stars: data.stargazerCount,
      forks: data.forkCount,
      github_pushed_at: data.pushedAt,
      github_created_at: data.createdAt,
      github_updated_at: data.updatedAt,
      github_description: data.description,
      github_homepage: data.homepageUrl,
      is_archived: data.isArchived,
      is_fork: data.isFork,
      default_branch: data.defaultBranchRef?.name,
      license: data.licenseInfo?.spdxId || data.licenseInfo?.name,
      primary_language: data.primaryLanguage?.name,
      topics: data.repositoryTopics?.nodes?.map(n => n.topic.name) || [],
      open_issues: data.openIssues?.totalCount,
      watchers: data.watchers?.totalCount,
      releases_count: data.releases?.totalCount,
      owner_avatar: data.owner?.avatarUrl,
      synced_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('external_skills')
      .update(updateData)
      .eq('repo', repoName);

    if (error) {
      failed++;
    } else {
      updated++;
    }
  }

  console.log(`\r✅ 数据库更新完成: ${updated} 成功, ${failed} 失败`);
}

async function main() {
  console.log('🚀 GitHub GraphQL 批量同步\n');

  // 检查 API 配额
  const rateQuery = 'query { rateLimit { limit remaining resetAt } }';
  const rateResult = await fetchGraphQL(rateQuery);
  const rate = rateResult.data?.rateLimit;

  if (rate) {
    console.log(`📊 API 配额: ${rate.remaining}/${rate.limit}`);
    console.log(`⏰ 重置时间: ${new Date(rate.resetAt).toLocaleString()}\n`);

    if (rate.remaining < 100) {
      console.log('❌ API 配额不足');
      process.exit(1);
    }
  }

  // 获取仓库列表
  const repos = await getUniqueRepos();
  console.log(`📦 共 ${repos.length} 个唯一仓库\n`);

  if (repos.length === 0) {
    console.log('没有需要同步的仓库');
    return;
  }

  // 批量获取 GitHub 数据
  const repoData = await syncAllRepos(repos);

  // 更新数据库
  if (repoData.size > 0) {
    await updateDatabase(repoData);
  }

  console.log('\n🎉 完成!');
}

main().catch(console.error);
