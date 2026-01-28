# Skills 数据同步重构方案（本地版）

## 一、现状问题

### 1. 脚本混乱
| 文件 | 问题 |
|------|------|
| `sync-all-stars.ts` | REST 逐个请求，消耗 1900 点，已被 GraphQL 方案替代 |
| `sync-github-paths.mjs` | 已有 v2 优化版，冗余 |
| `fix-github-urls.mjs` | 一次性修复脚本，已完成使命 |

### 2. API 路由重复
| 路由 | 问题 |
|------|------|
| `/api/cron/sync-external-skills` | 功能太重，做了太多事 |
| `/api/cron/sync-skills-sh` | 轻量版，与上面功能重叠 |
| `/api/cron/sync-stars` | 只同步 top 30，定位不清 |

### 3. 硬编码凭证
多个脚本中有硬编码的 `SUPABASE_SERVICE_ROLE_KEY` 和 `GITHUB_TOKEN`。

---

## 二、目标架构（纯本地）

```
┌─────────────────────────────────────────────────────────────┐
│                      数据源                                  │
│  skills.sh API ────────────────────► GitHub API (GraphQL)   │
│  (~50k skills)                        (1900 仓库)            │
└──────────────┬─────────────────────────────┬────────────────┘
               │                             │
               ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Mac mini / 本地                           │
│                                                             │
│  脚本 1: sync-skills-sh.mjs                                 │
│  ├── 频率: 每小时                                            │
│  ├── 拉取 skills.sh 全量数据                                 │
│  ├── 更新 installs, 创建新记录                               │
│  └── 耗时: <30秒                                            │
│                                                             │
│  脚本 2: sync-github.mjs                                    │
│  ├── 频率: 每天一次                                          │
│  ├── GraphQL 批量获取 GitHub 数据                            │
│  ├── 更新 stars, forks, description 等                      │
│  └── 耗时: ~7分钟, ~40 API 点                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Supabase      │
                    │   Database      │
                    │                 │
                    │ • external_skills│
                    │ • authors       │
                    └─────────────────┘
```

---

## 三、精简后的文件结构

### 保留

```
scripts/
├── sync-skills-sh.mjs         # 同步 skills.sh 数据
├── sync-github.mjs            # 同步 GitHub 数据 (GraphQL)
└── run-migration.mjs          # 迁移工具
```

### 删除

```
scripts/
├── sync-all-stars.ts          ❌ 被 GraphQL 替代
├── sync-github-paths.mjs      ❌ 被 v2 替代
├── sync-github-paths-v2.mjs   ❌ 合并到 sync-github.mjs
├── fix-github-urls.mjs        ❌ 一次性脚本，已完成
└── sync-github-graphql.mjs    ❌ 重命名为 sync-github.mjs

src/app/api/cron/              ❌ 整个目录删除（不再用 CF 定时任务）
├── sync-external-skills/
├── sync-skills-sh/
└── sync-stars/
```

---

## 四、新的同步流程

### 流程 A：skills.sh 同步

**脚本**: `scripts/sync-skills-sh.mjs`
**触发**: launchd 每小时
**耗时**: <1分钟
**GitHub API**: 0 调用

```
输入: skills.sh API (~50k skills)
输出: external_skills 表, authors 表

步骤:
1. 拉取 skills.sh 全量数据
   GET https://skills.sh/api/skills?limit=50000
   返回: { skills: [{ id, name, installs, topSource }, ...] }

2. 解析每个 skill 的 topSource
   topSource 格式: "github:owner/repo/path" 或 "github:owner/repo"
   提取: owner, repo, path

3. 收集所有唯一的 GitHub owners
   去重后约 1500+ 个不同的 owner

4. 确保 authors 表存在这些 owner
   - 查询已存在的 authors
   - 对缺失的 owner，创建占位记录（不调用 GitHub API）
   - 返回 github_login → author_id 映射

5. 批量 upsert external_skills 表
   每条记录包含:
   - source: 'github'
   - source_id: skill.name (唯一标识)
   - name, slug
   - repo: 'owner/repo'
   - repo_path: path 或 skill.name
   - branch: 'main'
   - raw_url: 拼接的 SKILL.md URL
   - author_id: 关联的作者
   - github_owner: owner 名
   - installs: 安装量
   - synced_at: 当前时间

6. 更新 authors 表统计
   调用 RPC: update_author_stats(author_id)
   更新每个作者的 skill 数量和总安装量
```

---

### 流程 B：GitHub 同步

**脚本**: `scripts/sync-github.mjs`
**触发**: launchd 每 6 小时
**耗时**: ~7分钟
**API 消耗**: ~40 点 (GraphQL)

```
输入: external_skills 表中的唯一仓库列表
输出: external_skills 表 GitHub 字段更新

步骤:
1. 从 external_skills 获取所有唯一仓库
   SELECT DISTINCT repo FROM external_skills WHERE repo IS NOT NULL
   约 1900 个唯一仓库

2. 检查 GitHub API 配额
   query { rateLimit { remaining limit resetAt } }
   如果 remaining < 100，退出

3. GraphQL 批量获取 (50个仓库/批)
   每批查询:
   query {
     repo_0: repository(owner: "xxx", name: "yyy") {
       nameWithOwner
       stargazerCount          # stars
       forkCount               # forks
       pushedAt                # 最后推送时间
       createdAt
       updatedAt
       description
       homepageUrl
       isArchived
       isFork
       defaultBranchRef { name }
       licenseInfo { name spdxId }
       primaryLanguage { name color }
       repositoryTopics(first: 10) { nodes { topic { name } } }
       openIssues: issues(states: OPEN) { totalCount }
       watchers { totalCount }
       releases { totalCount }
       owner { login avatarUrl ... }
     }
     repo_1: ...
     rateLimit { cost remaining }
   }

4. 批量更新 external_skills 表
   对每个仓库，更新所有关联的 skills:
   UPDATE external_skills SET
     stars = ...,
     forks = ...,
     github_pushed_at = ...,
     github_description = ...,
     primary_language = ...,
     topics = [...],
     license = ...,
     is_archived = ...,
     owner_avatar = ...,
     synced_at = NOW()
   WHERE repo = 'owner/repo'

5. 更新 authors 表头像
   如果 owner 头像变化，更新 authors.avatar_url
```

---

## 五、数据库字段规划

### external_skills 表

```sql
-- 来源标识
source TEXT,                    -- 'github'
source_id TEXT,                 -- skills.sh name (唯一键)

-- 基本信息
name TEXT,
slug TEXT,
description TEXT,               -- 来自 GitHub

-- GitHub 仓库信息
repo TEXT,                      -- owner/repo
repo_path TEXT,                 -- skills/xxx
branch TEXT DEFAULT 'main',
raw_url TEXT,                   -- SKILL.md URL

-- GitHub 统计
stars INTEGER,
forks INTEGER,
watchers INTEGER,
open_issues INTEGER,

-- GitHub 元数据
primary_language TEXT,
topics TEXT[],
license TEXT,
is_archived BOOLEAN,
is_fork BOOLEAN,
default_branch TEXT,
releases_count INTEGER,

-- GitHub 时间
github_pushed_at TIMESTAMPTZ,
github_created_at TIMESTAMPTZ,
github_updated_at TIMESTAMPTZ,

-- 作者
author_id UUID,
github_owner TEXT,
owner_avatar TEXT,

-- skills.sh 数据
installs INTEGER,

-- 同步状态
synced_at TIMESTAMPTZ,          -- 最后同步时间
needs_github_sync BOOLEAN,      -- 是否需要 GitHub 同步
content_updated_at TIMESTAMPTZ, -- SKILL.md 最后更新

-- 其他
verified BOOLEAN
```

---

## 六、定时任务配置（launchd）

### A. skills.sh 同步（每小时）

```xml
<!-- ~/Library/LaunchAgents/com.skillshot.sync-skills-sh.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.skillshot.sync-skills-sh</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/skills-hot/scripts/sync-skills-sh.mjs</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>EnvironmentVariables</key>
    <dict>
        <key>SUPABASE_URL</key>
        <string>xxx</string>
        <key>SUPABASE_SERVICE_ROLE_KEY</key>
        <string>xxx</string>
    </dict>
    <key>StandardOutPath</key>
    <string>/var/log/skillshot/sync-skills-sh.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/skillshot/sync-skills-sh.error.log</string>
</dict>
</plist>
```

### B. GitHub 同步（每 6 小时）

```xml
<!-- ~/Library/LaunchAgents/com.skillshot.sync-github.plist -->
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
    <key>StartInterval</key>
    <integer>21600</integer>
    <key>EnvironmentVariables</key>
    <dict>
        <key>GITHUB_TOKEN</key>
        <string>xxx</string>
        <key>SUPABASE_URL</key>
        <string>xxx</string>
        <key>SUPABASE_SERVICE_ROLE_KEY</key>
        <string>xxx</string>
    </dict>
    <key>StandardOutPath</key>
    <string>/var/log/skillshot/sync-github.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/skillshot/sync-github.error.log</string>
</dict>
</plist>
```

### 安装命令

```bash
# 创建日志目录
sudo mkdir -p /var/log/skillshot
sudo chown $(whoami) /var/log/skillshot

# 加载定时任务
launchctl load ~/Library/LaunchAgents/com.skillshot.sync-skills-sh.plist
launchctl load ~/Library/LaunchAgents/com.skillshot.sync-github.plist

# 手动触发测试
launchctl start com.skillshot.sync-skills-sh
launchctl start com.skillshot.sync-github

# 查看状态
launchctl list | grep skillshot
```

---

## 七、实施步骤

### Phase 1: 创建新脚本

- [ ] 创建 `scripts/sync-skills-sh.mjs`（从现有 API 提取逻辑）
- [ ] 重命名 `sync-github-graphql.mjs` → `sync-github.mjs`
- [ ] 两个脚本都使用纯环境变量，无硬编码

### Phase 2: 删除旧文件

- [ ] 删除 `scripts/sync-all-stars.ts`
- [ ] 删除 `scripts/sync-github-paths.mjs`
- [ ] 删除 `scripts/sync-github-paths-v2.mjs`
- [ ] 删除 `scripts/fix-github-urls.mjs`
- [ ] 删除 `src/app/api/cron/` 整个目录

### Phase 3: 测试

- [ ] 本地测试 `sync-skills-sh.mjs`
- [ ] 本地测试 `sync-github.mjs`
- [ ] 验证数据正确性

### Phase 4: 部署

- [ ] 创建 launchd plist 文件
- [ ] 配置环境变量
- [ ] 加载定时任务
- [ ] 监控运行状态

---

## 八、API 消耗预估

| 任务 | 频率 | 单次消耗 | 月消耗 |
|------|------|---------|--------|
| skills.sh 同步 | 24次/天 | 0 点 | 0 点 |
| GitHub 同步 | 4次/天 | 40 点 | 4,800 点 |
| **总计** | - | - | **~4,800 点/月** |

GitHub GraphQL API 限制: 5,000 点/小时 → **完全够用**
| skills.sh 轻量同步 | 24次/天 | 0 点 | 0 点 |
| GitHub 全量同步 | 1次/天 | 40 点 | 1,200 点 |
| **总计** | - | - | **~1,200 点/月** |

GitHub API 限制: 5,000 点/小时 → **完全够用**

---

## 九、监控

### 日志

```bash
# Mac mini
tail -f /var/log/skillshot/sync-github.log

# Cloudflare
wrangler tail
```

### 健康检查

```sql
-- 检查同步状态
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE synced_at > NOW() - INTERVAL '1 day') as synced_today,
  COUNT(*) FILTER (WHERE needs_github_sync = true) as pending_sync,
  MAX(synced_at) as last_sync
FROM external_skills;
```

---

## 十、回滚方案

如果新流程出问题：

```bash
# 停止定时任务
launchctl unload ~/Library/LaunchAgents/com.skillshot.sync-skills-sh.plist
launchctl unload ~/Library/LaunchAgents/com.skillshot.sync-github.plist

# 从 git 恢复删除的文件
git checkout HEAD~1 -- scripts/
git checkout HEAD~1 -- src/app/api/cron/
```

---

## 总结

| 之前 | 之后 |
|------|------|
| 6 个脚本 | 2 个脚本 |
| 3 个 API 路由 | 0 个 |
| CF + 本地混合 | 纯本地 |
| REST API (慢) | GraphQL (快) |
| ~2000 API 点/天 | ~40 API 点/天 |
| 职责混乱 | 职责清晰 |
