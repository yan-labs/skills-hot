# Skills 数据同步架构

## 概述

本架构将数据同步任务分为两层：
- **Cloudflare Workers**：轻量、高频，只处理 skills.sh 数据
- **Mac mini**：重活、无限制，处理 GitHub 数据补充

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers                           │
│                       (轻量、高频)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  每小时: /api/cron/sync-skills-sh-light                    │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │  1. 拉取 skills.sh 全量数据                                │  │
│  │  2. 立即更新 installs（用户可见变化）                      │  │
│  │  3. 检测新增 skill，标记 needs_github_sync = true          │  │
│  │  4. 不请求任何 GitHub API                                  │  │
│  │                                                            │  │
│  │  耗时: < 10 秒                                             │  │
│  │  Subrequest: 1（只有 skills.sh API）                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         (Supabase)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Mac mini                                 │
│                      (重活、无限制)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  每 6 小时: sync-github-incremental                        │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │  1. 查询 needs_github_sync = true 的 skill                 │  │
│  │  2. 提取唯一仓库列表                                       │  │
│  │  3. GraphQL 批量获取: stars, forks, owner info 等          │  │
│  │  4. 更新数据库，清除 needs_github_sync 标记                │  │
│  │                                                            │  │
│  │  耗时: 1-3 分钟（视新增数量）                              │  │
│  │  API 消耗: ~10-20 点                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  每周一次: sync-github-full                                │  │
│  │  ─────────────────────────────────────────────────────────│  │
│  │  1. 获取所有唯一仓库列表（~1900 个）                       │  │
│  │  2. GraphQL 批量刷新: stars, forks, pushedAt 等            │  │
│  │  3. 更新所有 author/owner 信息                            │  │
│  │  4. 清理不存在的仓库记录                                   │  │
│  │                                                            │  │
│  │  耗时: ~7 分钟                                             │  │
│  │  API 消耗: ~40 点                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 数据库 Schema 改动

### 新增字段

```sql
-- external_skills 表新增字段
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS needs_github_sync BOOLEAN DEFAULT false;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS fork_count INTEGER DEFAULT 0;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS watchers_count INTEGER DEFAULT 0;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS open_issues_count INTEGER DEFAULT 0;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS releases_count INTEGER DEFAULT 0;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS repo_created_at TIMESTAMPTZ;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS repo_updated_at TIMESTAMPTZ;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS repo_pushed_at TIMESTAMPTZ;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS repo_description TEXT;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS repo_homepage_url TEXT;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS repo_license TEXT;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS repo_language TEXT;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS repo_topics TEXT[];  -- PostgreSQL array
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE external_skills ADD COLUMN IF NOT EXISTS is_fork BOOLEAN DEFAULT false;

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_external_skills_needs_sync
  ON external_skills(needs_github_sync) WHERE needs_github_sync = true;

CREATE INDEX IF NOT EXISTS idx_external_skills_repo
  ON external_skills(repo);
```

### 新增仓库表（可选，用于去重）

```sql
-- 仓库信息表（与 skill 解耦）
CREATE TABLE IF NOT EXISTS github_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_with_owner TEXT UNIQUE NOT NULL,  -- "owner/repo"
  owner_login TEXT NOT NULL,

  -- GitHub 数据
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  watchers INTEGER DEFAULT 0,
  open_issues INTEGER DEFAULT 0,
  releases INTEGER DEFAULT 0,

  -- 时间
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  pushed_at TIMESTAMPTZ,

  -- 元信息
  description TEXT,
  homepage_url TEXT,
  license TEXT,
  language TEXT,
  topics TEXT[],
  is_archived BOOLEAN DEFAULT false,
  is_fork BOOLEAN DEFAULT false,
  default_branch TEXT DEFAULT 'main',

  -- 同步状态
  synced_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT github_repos_name_with_owner_key UNIQUE (name_with_owner)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_github_repos_owner ON github_repos(owner_login);
CREATE INDEX IF NOT EXISTS idx_github_repos_stars ON github_repos(stars DESC);
```

## 定时任务调度

### Cloudflare Workers (wrangler.toml)

```toml
[triggers]
# 每小时第 5 分钟（避开整点）
crons = ["5 * * * *"]
```

### Mac mini (launchd)

创建 `~/Library/LaunchAgents/com.skillshot.sync-github.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.skillshot.sync-github</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/skills-hot/scripts/sync-github.mjs</string>
    </array>

    <key>StartCalendarInterval</key>
    <array>
        <!-- 每 6 小时: 00:10, 06:10, 12:10, 18:10 -->
        <dict>
            <key>Hour</key><integer>0</integer>
            <key>Minute</key><integer>10</integer>
        </dict>
        <dict>
            <key>Hour</key><integer>6</integer>
            <key>Minute</key><integer>10</integer>
        </dict>
        <dict>
            <key>Hour</key><integer>12</integer>
            <key>Minute</key><integer>10</integer>
        </dict>
        <dict>
            <key>Hour</key><integer>18</integer>
            <key>Minute</key><integer>10</integer>
        </dict>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
        <key>GITHUB_TOKEN</key>
        <string>your_github_token</string>
        <key>SUPABASE_URL</key>
        <string>your_supabase_url</string>
        <key>SUPABASE_SERVICE_KEY</key>
        <string>your_supabase_key</string>
    </dict>

    <key>StandardOutPath</key>
    <string>/tmp/sync-github.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/sync-github.error.log</string>

    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
```

加载定时任务：
```bash
launchctl load ~/Library/LaunchAgents/com.skillshot.sync-github.plist
```

### 时间线示例

```
时间 (UTC)
─────────────────────────────────────────────────────────
00:05  [CF] 小时同步 → 更新 installs，标记新增
00:10  [Mac] 6小时增量 → 处理新增的 GitHub 数据
01:05  [CF] 小时同步
02:05  [CF] 小时同步
...
06:05  [CF] 小时同步
06:10  [Mac] 6小时增量
...
00:10 周日  [Mac] 全量刷新（可选：在增量同步后触发）
```

## API 消耗估算

| 任务 | 频率 | 单次消耗 | 月消耗 |
|------|------|----------|--------|
| CF 小时同步 | 24次/天 | 0 点 | 0 |
| Mac 增量同步 | 4次/天 | ~15 点 | ~1,800 点 |
| Mac 全量同步 | 1次/周 | ~40 点 | ~160 点 |
| **总计** | | | **~2,000 点/月** |

GitHub API 限制：5,000 点/小时 = 3,600,000 点/月

**使用率：< 0.1%**，完全没有压力。

## 文件结构

```
skills-hot/
├── src/
│   └── app/
│       └── api/
│           └── cron/
│               ├── sync-skills-sh-light/    # CF 轻量同步
│               │   └── route.ts
│               └── sync-external-skills/     # 现有完整同步（可保留备用）
│                   └── route.ts
├── scripts/
│   ├── sync-github.mjs                       # Mac mini 主脚本
│   ├── sync-github-incremental.mjs           # 增量同步
│   └── sync-github-full.mjs                  # 全量同步
├── supabase/
│   └── migrations/
│       └── 20260128000000_add_github_sync_fields.sql
└── .claude/
    └── skills/
        ├── github-graphql-batch-sync.md
        └── skills-sync-architecture.md       # 本文档
```

## 监控与告警

### 日志检查

```bash
# 查看 Mac mini 同步日志
tail -f /tmp/sync-github.log

# 查看错误日志
tail -f /tmp/sync-github.error.log
```

### 健康检查端点

```typescript
// /api/health/sync-status
export async function GET() {
  const { data } = await supabase
    .from('external_skills')
    .select('needs_github_sync')
    .eq('needs_github_sync', true);

  return Response.json({
    pending_sync: data?.length || 0,
    healthy: (data?.length || 0) < 1000  // 如果积压超过 1000，告警
  });
}
```

## 回滚方案

如果新架构出问题，可以临时切换回原有的 `sync-external-skills` 端点：

```toml
# wrangler.toml
[triggers]
crons = ["0 */6 * * *"]  # 恢复 6 小时全量
```

并在 worker-wrapper.js 中调用原端点。

## 后续优化

1. **增量检测优化**：用 skills.sh 的 hash 或 lastModified 判断是否有变化
2. **并行处理**：Mac mini 可以并行处理多个批次
3. **缓存层**：热门 skill 数据缓存到 KV
4. **实时推送**：skills.sh 如果支持 webhook，可以实时触发同步
