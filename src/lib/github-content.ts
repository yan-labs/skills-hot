/**
 * GitHub Content Fetcher with Caching
 * 用于从 GitHub 获取 SKILL.md 内容并缓存
 */

// 简单的内存缓存（生产环境应使用 Redis/KV）
const contentCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 3600 * 1000; // 1 小时

/**
 * 解析 topSource 字符串，提取 GitHub 仓库信息
 * @param topSource - 格式: "owner/repo" 或 "owner/repo/path/to/skill"
 */
export function parseTopSource(topSource: string): {
  owner: string;
  repo: string;
  path: string | null;
} {
  const parts = topSource.split('/');
  return {
    owner: parts[0] || '',
    repo: parts[1] || '',
    path: parts.length > 2 ? parts.slice(2).join('/') : null,
  };
}

/**
 * 生成 GitHub raw content URL
 */
export function getGitHubRawUrl(
  owner: string,
  repo: string,
  branch: string = 'main',
  path?: string | null
): string {
  const basePath = path ? `${path}/` : '';
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${basePath}SKILL.md`;
}

/**
 * 从 GitHub 获取 SKILL.md 内容
 * @param rawUrl - GitHub raw content URL
 * @returns Markdown 内容
 */
export async function fetchGitHubContent(rawUrl: string): Promise<string> {
  // 1. 检查内存缓存
  const cached = contentCache.get(rawUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }

  // 2. 从 GitHub 获取
  try {
    const response = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'SkillsHot/1.0',
        Accept: 'text/plain',
      },
      next: { revalidate: 3600 }, // Next.js cache for 1 hour
    });

    if (!response.ok) {
      console.error(`GitHub fetch failed: ${response.status} for ${rawUrl}`);
      return '# Content Unavailable\n\nCould not fetch content from GitHub.';
    }

    const content = await response.text();

    // 3. 缓存内容
    contentCache.set(rawUrl, {
      content,
      timestamp: Date.now(),
    });

    return content;
  } catch (error) {
    console.error('GitHub fetch error:', error);
    return '# Content Unavailable\n\nCould not fetch content from GitHub.';
  }
}

/**
 * 智能获取 SKILL.md 内容，尝试多种可能的路径
 * @param owner - 仓库所有者
 * @param repo - 仓库名
 * @param skillName - skill 名称
 * @param repoPath - 可选的仓库路径提示
 * @returns Markdown 内容
 */
export async function fetchSkillContent(
  owner: string,
  repo: string,
  skillName: string,
  repoPath?: string | null
): Promise<string> {
  // 构建可能的 URL 列表（按优先级排序）
  const possibleUrls: string[] = [];
  const branch = 'main';

  // 1. 如果有 repoPath，先尝试 skills/{repoPath}（常见的 monorepo 结构）
  if (repoPath) {
    possibleUrls.push(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${repoPath}/SKILL.md`
    );
    // 2. 尝试直接的 {repoPath}
    possibleUrls.push(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${repoPath}/SKILL.md`
    );
  }

  // 3. 尝试 skills/{skillName}
  possibleUrls.push(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/${skillName}/SKILL.md`
  );

  // 4. 尝试直接的 {skillName}
  possibleUrls.push(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillName}/SKILL.md`
  );

  // 5. 尝试根目录 SKILL.md
  possibleUrls.push(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/SKILL.md`
  );

  // 去重
  const uniqueUrls = [...new Set(possibleUrls)];

  // 尝试每个 URL
  for (const url of uniqueUrls) {
    // 检查缓存
    const cached = contentCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.content;
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SkillsHot/1.0',
          Accept: 'text/plain',
        },
        next: { revalidate: 3600 },
      });

      if (response.ok) {
        const content = await response.text();
        // 缓存成功的结果
        contentCache.set(url, {
          content,
          timestamp: Date.now(),
        });
        return content;
      }
    } catch {
      // 继续尝试下一个 URL
    }
  }

  return '# Content Unavailable\n\nCould not fetch SKILL.md from GitHub.';
}

/**
 * 从 GitHub 获取仓库目录中的文件列表
 */
export async function fetchGitHubDirectory(
  owner: string,
  repo: string,
  path?: string | null,
  branch: string = 'main'
): Promise<Array<{ name: string; path: string; type: string; download_url: string | null }>> {
  const apiPath = path ? `contents/${path}` : 'contents';
  const url = `https://api.github.com/repos/${owner}/${repo}/${apiPath}?ref=${branch}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SkillsHot/1.0',
        Accept: 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
    });

    if (!response.ok) {
      console.error(`GitHub API failed: ${response.status}`);
      return [];
    }

    const data = await response.json();

    // GitHub API 返回数组（目录）或对象（单个文件）
    if (!Array.isArray(data)) {
      return data.type === 'file' ? [data] : [];
    }

    return data;
  } catch (error) {
    console.error('GitHub directory fetch error:', error);
    return [];
  }
}

/**
 * 获取 GitHub 仓库信息（包括 stars）
 */
export async function fetchGitHubRepo(owner: string, repo: string): Promise<{
  id: number;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
} | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SkillsHot/1.0',
        Accept: 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
    });

    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`GitHub repo fetch failed: ${response.status} for ${owner}/${repo}`);
      }
      return null;
    }

    const data = await response.json();
    return {
      id: data.id,
      full_name: data.full_name,
      description: data.description,
      stargazers_count: data.stargazers_count,
      forks_count: data.forks_count,
      open_issues_count: data.open_issues_count,
      default_branch: data.default_branch,
    };
  } catch (error) {
    console.error('GitHub repo fetch error:', error);
    return null;
  }
}

/**
 * 获取 GitHub 用户信息
 */
export async function fetchGitHubUser(username: string): Promise<{
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
} | null> {
  const url = `https://api.github.com/users/${username}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SkillsHot/1.0',
        Accept: 'application/vnd.github.v3+json',
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      console.error(`GitHub user fetch failed: ${response.status}`);
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
  } catch (error) {
    console.error('GitHub user fetch error:', error);
    return null;
  }
}

/**
 * 探测并返回正确的 GitHub 目录 URL
 * 尝试多种可能的路径结构，返回第一个存在的路径
 * @param owner - 仓库所有者
 * @param repo - 仓库名
 * @param skillName - skill 名称
 * @param repoPath - 数据库中存储的路径提示（可能不准确）
 * @returns 正确的 GitHub 目录 URL，或 null
 */
export async function findGitHubSkillUrl(
  owner: string,
  repo: string,
  skillName: string,
  repoPath?: string | null
): Promise<string | null> {
  const branch = 'main';
  const baseUrl = `https://github.com/${owner}/${repo}/tree/${branch}`;

  // 构建可能的路径列表（按优先级排序）
  const possiblePaths: string[] = [];

  // 从 skillName 中移除可能的前缀（如 vercel-react-best-practices -> react-best-practices）
  // 常见模式：{owner}-{actualPath}、{ownerFirstPart}-{actualPath} 或 {repo}-{actualPath}
  // 例如 owner="vercel-labs" 时，也尝试移除 "vercel-" 前缀
  const ownerFirstPart = owner.split('-')[0];
  const strippedName = skillName
    .replace(new RegExp(`^${owner}-`, 'i'), '')
    .replace(new RegExp(`^${ownerFirstPart}-`, 'i'), '')
    .replace(new RegExp(`^${repo}-`, 'i'), '');

  // 1. 优先尝试 skills/{strippedName}（monorepo 常见结构）
  if (strippedName !== skillName) {
    possiblePaths.push(`skills/${strippedName}`);
  }

  // 2. 如果有 repoPath，尝试 skills/{repoPath 去除前缀}
  if (repoPath) {
    const strippedPath = repoPath
      .replace(new RegExp(`^${owner}-`, 'i'), '')
      .replace(new RegExp(`^${ownerFirstPart}-`, 'i'), '')
      .replace(new RegExp(`^${repo}-`, 'i'), '');
    if (strippedPath !== repoPath) {
      possiblePaths.push(`skills/${strippedPath}`);
    }
    possiblePaths.push(`skills/${repoPath}`);
    possiblePaths.push(repoPath);
  }

  // 3. 尝试 skills/{skillName}
  possiblePaths.push(`skills/${skillName}`);

  // 4. 尝试直接的 {skillName}
  possiblePaths.push(skillName);

  // 去重
  const uniquePaths = [...new Set(possiblePaths)];

  // 尝试每个路径，找到第一个存在的
  for (const path of uniquePaths) {
    try {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'SkillsHot/1.0',
          Accept: 'application/vnd.github.v3+json',
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      });

      if (response.ok) {
        return `${baseUrl}/${path}`;
      }
    } catch {
      // 继续尝试下一个路径
    }
  }

  // 如果都找不到，返回仓库根目录
  return `https://github.com/${owner}/${repo}`;
}

/**
 * 生成 URL-friendly slug
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 清理过期缓存
 */
export function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of contentCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      contentCache.delete(key);
    }
  }
}

/**
 * 清空所有缓存（用于测试）
 */
export function clearCache(): void {
  contentCache.clear();
}

// 定期清理缓存（每小时）
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, CACHE_TTL);
}
