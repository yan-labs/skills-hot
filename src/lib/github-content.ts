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
        'User-Agent': 'SkillBank/1.0',
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
        'User-Agent': 'SkillBank/1.0',
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
        'User-Agent': 'SkillBank/1.0',
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
        'User-Agent': 'SkillBank/1.0',
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
