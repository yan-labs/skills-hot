# SkillBank 主页设计研究

## 竞品分析

### 技能/插件市场类

| 网站 | 特点 |
|------|------|
| **skills.sh** | 极简黑白风格，纯文本列表，无图片，技术感强 |
| **VS Code Marketplace** | 卡片式布局，Featured/Most Popular/Highest Rated 分类，有图标和评分 |
| **npm** | 现代渐变风格，强调搜索功能，简洁的价值主张 |

### 新闻/杂志风格

| 网站 | 可借鉴的元素 |
|------|-------------|
| **纽约时报** | 多栏布局、衬线标题、图文混排、分类标签、细线分隔 |
| **卫报** | 色块分区、重要新闻突出显示、清晰的层级关系 |
| **Monocle** | 黄色强调色、混合布局（大图+列表）、分栏专题区 |
| **经济学人** | 红色品牌色、清晰的内容分区、专题封面展示 |

### 优秀产品网站

| 网站 | 特点 |
|------|------|
| **Linear** | 暗色主题、动画展示、功能分块详细介绍 |
| **Stripe Press** | 极简、大量留白、优雅排版 |

---

## 设计要点

### 1. 内容分区（报纸风格）

- **"头条"** - 精选/编辑推荐技能（大卡片，突出展示）
- **"本周热门"** - 安装量排行榜
- **"新上架"** - 最新发布的技能
- **"分类浏览"** - 按类别展示（开发工具、SEO、设计等）
- **"作者聚焦"** - 突出贡献者/明星作者
- **"使用案例"** - 用户故事/案例展示

### 2. 报纸视觉元素

- 多栏布局（2-3栏，像报纸版面）
- 衬线大标题 + 无衬线正文
- 细线/双线分隔符
- 期号/日期显示（如 "Vol. 1 · January 2025"）
- 栏目标签（FEATURED, TRENDING, NEW, EDITOR'S PICK）
- Pull quotes（引用样式）
- 图文混排

### 3. 可信度内容

- 统计数字展示
  - 总技能数量
  - 总安装次数
  - 活跃作者数
  - 支持的 AI 代理数
- 用户评价/推荐语
- 合作伙伴/集成 Logo
- "Featured in" 媒体报道

### 4. 功能性内容

- 快速开始指南
- 热门搜索关键词
- 分类导航
- 订阅 Newsletter
- 社区链接

---

## 参考截图

保存在项目根目录：
- `skills-sh.png`
- `vscode-marketplace.png`
- `npm.png`
- `nytimes.png`
- `guardian.png`
- `monocle.png`
- `economist.png`
- `linear.png`
- `stripe-press.png`

---

## 已实现功能总结

### 数据库表结构

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| **skills** | 本地发布的技能 | name, slug, description, content, author, user_id, is_private, version, storage_path |
| **external_skills** | GitHub 来源技能（从 skills.sh 同步） | name, slug, repo, raw_url, installs, stars, author_id |
| **authors** | 作者信息 | github_id, github_login, name, avatar_url, user_id, external_skill_count, total_installs |
| **skill_stats** | 技能统计 | skill_id, installs, views, copies, favorites |
| **stat_events** | 统计事件日志 | skill_id, event_type, created_at |
| **skill_access** | 私有技能访问权限 | skill_id, user_id, access_type, expires_at |
| **skill_files** | 技能附属文件 | skill_id, file_path, storage_key |
| **device_codes** | 设备认证码 | device_code, user_code, status, expires_at |
| **cli_tokens** | CLI 访问令牌 | user_id, token_hash, name, last_used_at |
| **download_tokens** | 分享短链令牌 | short_code, token_hash, skill_id, expires_at, max_uses |
| **skills_sh_cache** | skills.sh 缓存 | name, installs, top_source |

### 后端 API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/skills` | GET | 搜索技能列表 |
| `/api/skills/ai-search` | GET | AI 语义搜索 |
| `/api/skills/publish` | POST | 发布技能 |
| `/api/skills/import` | POST | 从外部导入技能 |
| `/api/skills/[slug]` | GET | 获取技能详情 |
| `/api/skills/[slug]/raw` | GET | 获取 SKILL.md 原始内容 |
| `/api/skills/[slug]/package` | GET | 下载技能包（ZIP） |
| `/api/skills/[slug]/privacy` | PATCH | 修改隐私设置 |
| `/api/skills/[slug]/share` | GET/POST | 分享链接管理 |
| `/api/authors/[login]` | GET | 作者详情 |
| `/api/user/skills` | GET | 当前用户技能列表 |
| `/api/auth/device` | POST | 启动设备认证 |
| `/api/auth/device/authorize` | POST | 用户授权设备 |
| `/api/auth/device/token` | POST | CLI 轮询获取令牌 |
| `/api/stats` | POST | 上报统计事件 |
| `/api/cron/sync-external-skills` | GET | 同步外部技能 |
| `/api/cron/sync-skills-sh` | GET | 同步 skills.sh 缓存 |

### CLI 命令

| 命令 | 功能 |
|------|------|
| `skb search <query>` | 搜索技能（普通 + AI） |
| `skb add <name>` | 安装技能 |
| `skb list` | 列出已安装技能 |
| `skb remove <name>` | 删除技能 |
| `skb update [name]` | 更新技能 |
| `skb info <name>` | 查看技能详情 |
| `skb publish [path]` | 发布技能 |
| `skb login` | OAuth 登录 |
| `skb logout` | 登出 |
| `skb whoami` | 查看当前用户 |

### WebUI 页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 主页 | `/` | Hero + 热门技能 + 特性介绍 |
| 技能列表 | `/skills` | 浏览所有技能 |
| 技能详情 | `/skills/[slug]` | 技能完整信息 |
| 作者列表 | `/authors` | 浏览作者 |
| 作者详情 | `/authors/[login]` | 作者信息和技能 |
| 搜索 | `/search` | 搜索结果页 |
| 文档 | `/docs` | 文档页面 |
| 登录 | `/auth/signin` | 登录页 |
| 注册 | `/auth/signup` | 注册页 |
| 设备授权 | `/auth/device` | CLI 授权页 |

### 核心功能特性

1. **技能市场**
   - ✅ 搜索（普通 + AI 语义）
   - ✅ 浏览和筛选
   - ✅ 详情展示
   - ✅ 安装统计

2. **用户系统**
   - ✅ GitHub OAuth 登录
   - ✅ CLI 设备认证流程
   - ✅ 个人技能管理

3. **技能发布**
   - ✅ CLI 发布
   - ✅ 私有/公开切换
   - ✅ 版本管理
   - ✅ ZIP 包上传

4. **数据同步**
   - ✅ skills.sh 同步
   - ✅ GitHub 作者信息同步
   - ✅ 外部技能导入

5. **分享系统**
   - ✅ 短链生成
   - ✅ Git clone 支持
   - ✅ 使用次数限制

6. **国际化**
   - ✅ 中文/英文支持

### 可用于首页展示的数据

基于已有的数据库和 API，首页可以展示：

1. **统计数字**
   - 技能总数（skills + external_skills 表）
   - 总安装次数（skill_stats.installs + external_skills.installs）
   - 作者数量（authors 表）

2. **技能列表**
   - 热门技能（按安装量排序）
   - 最新技能（按 created_at 排序）
   - 编辑精选（可增加 is_featured 字段）
   - 分类浏览（按 category 分组）

3. **作者展示**
   - 顶级贡献者（按 total_installs 排序）
   - 活跃作者

4. **搜索和分类**
   - 热门搜索词（可从 stat_events 统计）
   - 分类标签（skills.category）
   - 标签云（skills.tags）
