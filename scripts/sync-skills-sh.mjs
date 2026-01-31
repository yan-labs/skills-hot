#!/usr/bin/env node
/**
 * skills.sh 数据同步脚本（增强版）
 *
 * 用法: node scripts/sync-skills-sh.mjs
 *
 * 功能:
 * - 从 skills.sh API 拉取全量数据
 * - 解析 topSource 提取 GitHub 仓库信息
 * - 从 SKILL.md 解析 platforms
 * - upsert external_skills 表
 * - 维护 authors 表（调用 GitHub API）
 *
 * 环境变量:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - GITHUB_TOKEN (可选，用于获取作者信息)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SKILLS_SH_API = 'https://skills.sh/api/skills?limit=50000';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 需要设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ============ 工具函数 ============

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

/**
 * 解析 YAML frontmatter
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const yamlContent = match[1];
  const frontmatter = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmedLine.slice(0, colonIndex).trim();
    const valueStr = trimmedLine.slice(colonIndex + 1).trim();

    // 解析数组语法: [item1, item2]
    if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
      const arrayContent = valueStr.slice(1, -1);
      frontmatter[key] = arrayContent
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    } else {
      frontmatter[key] = valueStr;
    }
  }

  return { frontmatter, content: match[2] };
}

/**
 * 从 SKILL.md 提取 platforms
 */
function extractPlatforms(content) {
  const { frontmatter } = parseFrontmatter(content);
  const platformsValue = frontmatter['platforms'];

  // Platform 名称标准化映射
  const platformAliases = {
    'claude': 'claudecode',
    'claudecode': 'claudecode',
    'claude-code': 'claudecode',
    'cursor': 'cursor',
    'windsurf': 'windsurf',
    'codex': 'codex',
    'copilot': 'copilot',
    'gemini': 'gemini',
    'cline': 'cline',
    'amp': 'amp',
    'antigravity': 'antigravity',
    'clawdbot': 'clawdbot',
    'droid': 'droid',
    'goose': 'goose',
    'kilo': 'kilo',
    'kiro': 'kiro-cli',
    'kirocli': 'kiro-cli',
    'kiro-cli': 'kiro-cli',
    'manus': 'manus',
    'moltbot': 'moltbot',
    'opencode': 'opencode',
    'roo': 'roo',
    'trae': 'trae',
    'universal': 'universal',
  };

  if (Array.isArray(platformsValue)) {
    const extracted = [];
    for (const p of platformsValue) {
      if (typeof p === 'string') {
        const normalized = p.toLowerCase().replace(/[^a-z0-9]/g, '');
        const platform = platformAliases[normalized];
        if (platform && !extracted.includes(platform)) {
          extracted.push(platform);
        }
      }
    }
    return extracted.length > 0 ? extracted : ['universal'];
  }

  // 检查字符串值
  if (typeof platformsValue === 'string') {
    const normalized = platformsValue.toLowerCase().replace(/[^a-z0-9]/g, '');
    const platform = platformAliases[normalized];
    if (platform) {
      return [platform];
    }
  }

  return ['universal'];
}

/**
 * 从 GitHub 获取 SKILL.md 内容
 * 返回 { content, actualPath } - actualPath 为 null 表示在根目录
 */
async function fetchSkillContent(owner, repo, skillName, repoPath) {
  // 定义可能的路径，格式: { url, path }
  // path 为 null 表示根目录
  const possiblePaths = [];

  // 1. 如果有 repoPath，先尝试 skills/{repoPath} 和直接 {repoPath}
  if (repoPath) {
    possiblePaths.push({
      url: `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${repoPath}/SKILL.md`,
      path: `skills/${repoPath}`,
    });
    possiblePaths.push({
      url: `https://raw.githubusercontent.com/${owner}/${repo}/main/${repoPath}/SKILL.md`,
      path: repoPath,
    });
  }

  // 2. 尝试 skills/{skillName}
  possiblePaths.push({
    url: `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${skillName}/SKILL.md`,
    path: `skills/${skillName}`,
  });

  // 3. 尝试直接的 {skillName}
  possiblePaths.push({
    url: `https://raw.githubusercontent.com/${owner}/${repo}/main/${skillName}/SKILL.md`,
    path: skillName,
  });

  // 4. 尝试根目录
  possiblePaths.push({
    url: `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`,
    path: null,
  });

  // 去重（按 URL）并尝试
  const seen = new Set();
  for (const { url, path } of possiblePaths) {
    if (seen.has(url)) continue;
    seen.add(url);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'SkillsHot/1.0', Accept: 'text/plain' },
      });

      if (response.ok) {
        const content = await response.text();
        return { content, actualPath: path };
      }
    } catch {
      // 继续尝试下一个
    }
  }

  return { content: null, actualPath: null };
}

/**
 * 从 GitHub 获取用户信息
 */
async function fetchGitHubUser(username) {
  if (!GITHUB_TOKEN) {
    return null;
  }

  const url = `https://api.github.com/users/${username}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SkillsHot/1.0',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      login: data.login,
      name: data.name,
      avatar_url: data.avatar_url,
      bio: data.bio,
    };
  } catch {
    return null;
  }
}

/**
 * 延迟函数（避免 GitHub API 限流）
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ 主逻辑 ============

async function main() {
  const startTime = Date.now();
  console.log('🚀 skills.sh 数据同步（增强版）\n');

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

  // 创建缺失的 authors
  const missingOwners = owners.filter(o => !authorMap.has(o));
  if (missingOwners.length > 0) {
    console.log(`  获取 ${missingOwners.length} 个新 authors 信息...`);

    for (const login of missingOwners) {
      const ghUser = await fetchGitHubUser(login);

      const authorData = {
        github_id: ghUser?.id || Math.floor(Math.random() * 1000000000),
        github_login: login,
        name: ghUser?.name || null,
        avatar_url: ghUser?.avatar_url || null,
        bio: ghUser?.bio || null,
      };

      const { data: inserted } = await supabase
        .from('authors')
        .upsert(authorData, { onConflict: 'github_login' })
        .select('id, github_login')
        .single();

      if (inserted) {
        authorMap.set(login, inserted.id);
      }

      // 避免 GitHub API 限流
      if (GITHUB_TOKEN) {
        await delay(100);
      }
    }
  }

  console.log(`✅ authors 表同步完成, 共 ${authorMap.size} 个\n`);

  // 4. 批量 upsert external_skills（包含 platforms）
  console.log('💾 更新 external_skills 表（含 platforms）...');
  let inserted = 0;
  let errors = 0;
  let platformsFetched = 0;

  for (let i = 0; i < skillsWithParsed.length; i += 2000) {
    const batch = skillsWithParsed.slice(i, i + 2000);
    const batchNum = Math.floor(i / 2000) + 1;
    const totalBatches = Math.ceil(skillsWithParsed.length / 2000);

    process.stdout.write(`\r  [${Math.min(i + 2000, skillsWithParsed.length)}/${skillsWithParsed.length}] Batch ${batchNum}/${totalBatches}`);

    const records = await Promise.all(batch.map(async (skill) => {
      const { owner, repo, path } = skill.parsed;
      const authorId = authorMap.get(owner) || null;

      // 获取 SKILL.md 内容和实际路径
      let platforms = ['universal'];
      let actualPath = path; // 默认使用 topSource 解析出的路径

      try {
        const result = await fetchSkillContent(owner, repo, skill.name, path);
        if (result.content) {
          platforms = extractPlatforms(result.content);
          actualPath = result.actualPath; // 使用实际找到的路径
          platformsFetched++;
        }
      } catch {
        // 失败时使用默认值
      }

      return {
        source: 'skills.sh',
        source_id: skill.name,
        name: skill.name,
        slug: generateSlug(skill.name),
        repo: `${owner}/${repo}`,
        repo_path: actualPath, // 可能为 null（表示根目录）
        branch: 'main',
        raw_url: getGitHubRawUrl(owner, repo, 'main', actualPath),
        author_id: authorId,
        github_owner: owner,
        installs: skill.installs || 0,
        platforms,
        synced_at: new Date().toISOString(),
      };
    }));

    const { error, count } = await supabase
      .from('external_skills')
      .upsert(records, { onConflict: 'source,source_id', ignoreDuplicates: false });

    if (error) {
      console.error('\n  ⚠️ upsert 错误:', error.message);
      errors++;
    } else {
      inserted += count || records.length;
    }
  }

  console.log(`\n✅ external_skills 更新完成: ${inserted} 条`);
  console.log(`   成功解析 platforms: ${platformsFetched} 个\n`);

  // 5. 更新 authors 统计
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
  console.log(`   platforms 解析: ${platformsFetched}`);
  if (errors > 0) console.log(`   错误: ${errors}`);
}

main().catch(err => {
  console.error('❌ 同步失败:', err);
  process.exit(1);
});
