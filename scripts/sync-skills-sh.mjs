#!/usr/bin/env node
/**
 * skills.sh 数据同步脚本
 *
 * 用法: node scripts/sync-skills-sh.mjs
 *
 * 功能:
 * - 从 skills.sh API 拉取全量数据
 * - 解析 topSource 提取 GitHub 仓库信息
 * - upsert external_skills 表
 * - 维护 authors 表
 *
 * 环境变量:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SKILLS_SH_API = 'https://skills.sh/api/skills?limit=50000';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 需要设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/**
 * 解析 topSource 字符串
 * 格式: "owner/repo" 或 "owner/repo/path/to/skill"
 */
function parseTopSource(topSource) {
  if (!topSource) return { owner: '', repo: '', path: null };
  const parts = topSource.split('/');
  return {
    owner: parts[0] || '',
    repo: parts[1] || '',
    path: parts.length > 2 ? parts.slice(2).join('/') : null,
  };
}

/**
 * 生成 URL-friendly slug
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 生成 GitHub raw URL
 */
function getGitHubRawUrl(owner, repo, branch, path) {
  const basePath = path ? `${path}/` : '';
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${basePath}SKILL.md`;
}

async function main() {
  const startTime = Date.now();
  console.log('🚀 skills.sh 数据同步\n');

  // 1. 拉取 skills.sh 全量数据
  console.log('📥 拉取 skills.sh 数据...');
  const response = await fetch(SKILLS_SH_API, {
    headers: { 'User-Agent': 'SkillsHot/1.0' },
  });

  if (!response.ok) {
    console.error(`❌ skills.sh API 错误: ${response.status}`);
    process.exit(1);
  }

  const data = await response.json();
  if (!data.skills || !Array.isArray(data.skills)) {
    console.error('❌ skills.sh 返回数据格式错误');
    process.exit(1);
  }

  console.log(`✅ 获取到 ${data.skills.length} 个 skills\n`);

  // 2. 解析 topSource，收集唯一 owners
  console.log('🔍 解析 topSource...');
  const ownerSet = new Set();
  const skillsWithParsed = [];

  for (const skill of data.skills) {
    if (!skill.topSource) continue;
    const parsed = parseTopSource(skill.topSource);
    if (parsed.owner && parsed.repo) {
      ownerSet.add(parsed.owner);
      skillsWithParsed.push({ ...skill, parsed });
    }
  }

  console.log(`✅ ${skillsWithParsed.length} 个有效 skills, ${ownerSet.size} 个唯一 owners\n`);

  // 3. 确保 authors 表存在这些 owner
  console.log('👤 同步 authors 表...');
  const authorMap = new Map(); // github_login -> author_id

  // 获取已存在的 authors
  const owners = Array.from(ownerSet);
  for (let i = 0; i < owners.length; i += 1000) {
    const batch = owners.slice(i, i + 1000);
    const { data: existingAuthors } = await supabase
      .from('authors')
      .select('id, github_login')
      .in('github_login', batch);

    if (existingAuthors) {
      for (const author of existingAuthors) {
        authorMap.set(author.github_login, author.id);
      }
    }
  }

  // 创建缺失的 authors（占位记录，不调用 GitHub API）
  const missingOwners = owners.filter(o => !authorMap.has(o));
  if (missingOwners.length > 0) {
    console.log(`  创建 ${missingOwners.length} 个新 authors...`);

    const newAuthors = missingOwners.map(login => ({
      github_id: Math.floor(Math.random() * 1000000000), // 临时 ID
      github_login: login,
      name: null,
      avatar_url: null,
      bio: null,
    }));

    // 分批插入
    for (let i = 0; i < newAuthors.length; i += 500) {
      const batch = newAuthors.slice(i, i + 500);
      const { data: inserted, error } = await supabase
        .from('authors')
        .upsert(batch, { onConflict: 'github_login', ignoreDuplicates: true })
        .select('id, github_login');

      if (error) {
        console.error('  ⚠️ authors upsert 错误:', error.message);
      } else if (inserted) {
        for (const author of inserted) {
          authorMap.set(author.github_login, author.id);
        }
      }
    }
  }

  console.log(`✅ authors 表同步完成, 共 ${authorMap.size} 个\n`);

  // 4. 获取已存在 skills 的 repo_path（避免覆盖）
  console.log('📂 获取已存在的 repo_path...');
  const existingPathMap = new Map();
  const skillNames = skillsWithParsed.map(s => s.name);

  for (let i = 0; i < skillNames.length; i += 1000) {
    const batch = skillNames.slice(i, i + 1000);
    const { data: existing } = await supabase
      .from('external_skills')
      .select('source_id, repo_path')
      .in('source_id', batch);

    if (existing) {
      for (const skill of existing) {
        if (skill.repo_path) {
          existingPathMap.set(skill.source_id, skill.repo_path);
        }
      }
    }
  }

  console.log(`✅ 获取到 ${existingPathMap.size} 个已存在的路径\n`);

  // 5. 批量 upsert external_skills
  console.log('💾 更新 external_skills 表...');
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < skillsWithParsed.length; i += 2000) {
    const batch = skillsWithParsed.slice(i, i + 2000);

    process.stdout.write(`\r  [${Math.min(i + 2000, skillsWithParsed.length)}/${skillsWithParsed.length}]`);

    const records = batch.map(skill => {
      const { owner, repo, path } = skill.parsed;
      const authorId = authorMap.get(owner) || null;

      // 优先使用已存在的路径
      const existingPath = existingPathMap.get(skill.name);
      const effectivePath = existingPath || path || skill.name;
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
        synced_at: new Date().toISOString(),
      };
    });

    const { error, count } = await supabase
      .from('external_skills')
      .upsert(records, { onConflict: 'source,source_id', ignoreDuplicates: false, count: 'exact' });

    if (error) {
      console.error('\n  ⚠️ upsert 错误:', error.message);
      errors++;
    } else {
      inserted += count || records.length;
    }
  }

  console.log(`\n✅ external_skills 更新完成: ${inserted} 条\n`);

  // 6. 更新 authors 统计
  console.log('📊 更新 authors 统计...');
  const uniqueAuthorIds = Array.from(new Set(Array.from(authorMap.values())));

  let statsUpdated = 0;
  for (let i = 0; i < uniqueAuthorIds.length; i += 100) {
    const batch = uniqueAuthorIds.slice(i, i + 100);

    process.stdout.write(`\r  [${Math.min(i + 100, uniqueAuthorIds.length)}/${uniqueAuthorIds.length}]`);

    for (const authorId of batch) {
      const { error } = await supabase.rpc('update_author_stats', { p_author_id: authorId });
      if (!error) statsUpdated++;
    }
  }

  console.log(`\n✅ authors 统计更新: ${statsUpdated} 个\n`);

  // 完成
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('🎉 同步完成!');
  console.log(`   耗时: ${elapsed}s`);
  console.log(`   skills: ${inserted}`);
  console.log(`   authors: ${authorMap.size}`);
  if (errors > 0) console.log(`   错误: ${errors}`);
}

main().catch(err => {
  console.error('❌ 同步失败:', err);
  process.exit(1);
});
