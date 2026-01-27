# GitHub Actions 配置指南

本项目使用 GitHub Actions 自动同步 skills.sh 数据和 GitHub stars。

## 需要配置的 Secrets

在仓库 **Settings → Secrets and variables → Actions → New repository secret** 中添加以下 Secrets：

### 1. NEXT_PUBLIC_SUPABASE_URL

Supabase 项目 URL。

```
https://eccwfcfoysauxnnsvcwn.supabase.co
```

### 2. SUPABASE_SERVICE_ROLE_KEY

Supabase 服务角色密钥（具有管理员权限）。

获取方式：
1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目 → Settings → API
3. 复制 `service_role` 密钥（注意：不是 `anon` 密钥）

### 3. CRON_SECRET

API 端点认证密钥，防止未授权访问。

可以生成一个随机字符串：
```bash
openssl rand -hex 32
```

**同时需要在 Cloudflare Workers 环境变量中添加相同的值。**

### 4. GH_PAT (GitHub Personal Access Token)

用于调用 GitHub API 获取仓库 stars，避免 rate limit。

#### 创建步骤：

1. 打开 [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)

2. 点击 **Generate new token (classic)**

3. 配置 Token：
   - **Note**: `Skills Hot Sync Stars`
   - **Expiration**: 选择有效期（建议 90 天或 1 年）
   - **Scopes**: 只需要勾选 `public_repo`（读取公开仓库信息）

4. 点击 **Generate token**

5. 复制生成的 token（以 `ghp_` 开头）

6. 在仓库 Secrets 中添加为 `GH_PAT`

#### 权限说明

| Scope | 说明 |
|-------|-----|
| `public_repo` | 读取公开仓库的基本信息（stars, forks 等） |

不需要其他权限，最小化权限原则。

#### Rate Limit

| 类型 | 限制 |
|-----|-----|
| 无 Token | 60 请求/小时 |
| 有 Token | 5000 请求/小时 |

## 工作流调度

| 任务 | Cron | 说明 |
|-----|------|-----|
| sync-skills | `0 */6 * * *` | 每 6 小时（UTC 0:00, 6:00, 12:00, 18:00）同步 skills.sh |
| sync-stars | `30 * * * *` | 每小时第 30 分钟同步 GitHub stars |

## 手动触发

1. 打开仓库 **Actions** 页面
2. 选择 **Sync Skills Data** 工作流
3. 点击 **Run workflow**
4. 选择同步类型：
   - `all`: 同步全部
   - `stars`: 仅同步 stars
   - `skills`: 仅同步 skills.sh 数据

## 验证配置

配置完成后，可以手动触发一次工作流测试：

```bash
gh workflow run sync-data.yml --field sync_type=all
```

或在 GitHub 网页界面手动触发。

## 故障排查

### Token 过期

GitHub PAT 过期后，sync-stars 任务会失败。需要重新生成 token 并更新 Secret。

### Rate Limit

如果看到 403 错误，可能是 GitHub API rate limit。脚本会自动等待重试。

### Supabase 连接失败

检查 `SUPABASE_SERVICE_ROLE_KEY` 是否正确，以及 Supabase 项目是否正常运行。
