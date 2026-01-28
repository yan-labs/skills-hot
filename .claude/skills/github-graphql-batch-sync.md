# GitHub GraphQL 批量同步

## 背景

从 skills.sh 同步数据时，需要获取 GitHub 仓库信息（stars、forks、owner 等）。由于：
- Cloudflare Workers 有 subrequest 限制（50-1000）
- REST API 每个仓库需要一次请求

使用 GraphQL API 可以批量获取，大幅减少请求数。

## 验证结果（2026-01-28 最终版）

| 指标 | 数值 |
|------|------|
| skills.sh 唯一仓库 | 1,900 |
| **成功获取** | **1,876 (98.7%)** |
| 未找到（已删除/私有） | 24 |
| 总 API 消耗 | **~40 点** |
| 总耗时 | **~7 分钟** |

### Top 10 Stars 仓库

| Stars | 仓库 |
|-------|------|
| 242,550 | facebook/react |
| 171,618 | n8n-io/n8n |
| 143,799 | f/awesome-chatgpt-prompts |
| 137,361 | vercel/next.js |
| 128,464 | microsoft/PowerToys |
| 127,560 | langgenius/dify |
| 119,914 | electron/electron |
| 96,979 | pytorch/pytorch |
| 92,726 | google-gemini/gemini-cli |
| 89,952 | anomalyco/opencode |

## GraphQL 查询模板

```graphql
query {
  repo_0: repository(owner: "owner1", name: "repo1") {
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
  }
  repo_1: repository(owner: "owner2", name: "repo2") {
    # 同样的字段...
  }
  # 每批最多 50 个仓库（建议值）
  rateLimit { limit cost remaining resetAt }
}
```

## 实现代码

```typescript
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// 构建批量查询
function buildQuery(repos: string[]): string {
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

  // 注意：使用字符串拼接避免模板字符串在某些环境下的问题
  return 'query { ' + repoQueries.join('\n') + ' rateLimit { limit cost remaining resetAt } }';
}

// 执行查询（带重试）
async function fetchGraphQL(query: string, retries = 3): Promise<any> {
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

      // 检查是否返回 HTML（错误页面）
      if (text.startsWith('<')) {
        throw new Error('Received HTML instead of JSON');
      }

      return JSON.parse(text);
    } catch (err) {
      if (attempt < retries) {
        console.log(`Retry ${attempt}/${retries - 1} after error: ${err.message}`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        throw err;
      }
    }
  }
}

// 批量同步
async function syncAllRepos(repos: string[]) {
  const BATCH_SIZE = 50; // 建议 50，避免单次查询过大
  const results = [];
  let totalCost = 0;

  for (let i = 0; i < repos.length; i += BATCH_SIZE) {
    const batch = repos.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(repos.length / BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches}...`);

    try {
      const query = buildQuery(batch);
      const result = await fetchGraphQL(query);

      if (result.data) {
        totalCost += result.data.rateLimit.cost;

        for (const [key, value] of Object.entries(result.data)) {
          if (key !== 'rateLimit' && value !== null) {
            results.push(value);
          }
        }
      }
    } catch (err) {
      console.error(`Batch ${batchNum} failed:`, err.message);
      // 可以记录失败批次，后续重试
    }

    // 延迟避免触发限制
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`Total cost: ${totalCost} points`);
  return results;
}
```

## 获取到的数据字段

| 字段 | 说明 |
|------|------|
| `nameWithOwner` | owner/repo 格式 |
| `stargazerCount` | stars 数 |
| `forkCount` | fork 数 |
| `pushedAt` | 最后推送时间 |
| `createdAt` | 创建时间 |
| `updatedAt` | 更新时间 |
| `description` | 仓库描述 |
| `homepageUrl` | 主页链接 |
| `isArchived` | 是否归档 |
| `isFork` | 是否是 fork |
| `defaultBranchRef.name` | 默认分支 |
| `licenseInfo` | 开源协议（name, spdxId） |
| `primaryLanguage` | 主要语言（name, color） |
| `repositoryTopics` | 仓库标签 |
| `openIssues.totalCount` | 开放 issue 数 |
| `watchers.totalCount` | watch 数 |
| `releases.totalCount` | 发布版本数 |
| `owner.*` | 所有者信息（id, login, name, avatarUrl, bio/description） |

## GitHub API 限制

| 类型 | 限制 |
|------|------|
| GraphQL 点数 | 5,000 点/小时 |
| 单次查询节点 | 500,000 |
| 每批 50 个仓库 | 约 1 点 |

**实测**：1900 个仓库只消耗 ~40 点，远低于 5000 点限制。

## 最佳实践

1. **批量大小**：建议 50 个/批，大批次（如 100）可能遇到网络问题
2. **延迟**：每批之间加 150ms 延迟
3. **重试机制**：网络偶发返回 HTML 错误页面，需要重试
4. **错误处理**：部分仓库可能不存在（返回 null），需跳过
5. **去重**：先对仓库列表去重，减少请求
6. **小批次重试**：如果大批次失败，可拆成小批次（10个）重试

## 适用场景

- Mac mini 定时任务（无 subrequest 限制）
- GitHub Actions
- 本地开发环境
- 任何需要批量获取 GitHub 仓库信息的场景

## 不适用场景

- Cloudflare Workers（subrequest 限制仍然存在，每次 GraphQL 请求 = 1 次 subrequest）
- 需要实时数据的场景（建议缓存 + 定时更新）
