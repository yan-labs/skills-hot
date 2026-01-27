# Claude Code Guidelines for Skills Hot

## Deployment

- **部署平台**: Cloudflare Workers (通过 OpenNext)
- **配置文件**: `wrangler.toml`, `open-next.config.ts`
- **部署命令**: `npx wrangler deploy` (需要先 `npm run build`)
- **生产域名**: https://skills.hot
- **不要**提及或假设使用 Vercel
- **注意**: 推送代码后需要手动运行 `npx wrangler deploy` 部署

## Database

- **Supabase** 托管 PostgreSQL
- **迁移方式**:
  - 正常情况: `npx supabase db push`
  - 如果 CLI 无法连接（代理/网络问题），使用 Edge Function 方式，参见 `skills/supabase-migration-via-edge-function.md`

## Data Sync

### skills.sh 同步

- **同步端点**: `/api/cron/sync-external-skills`
- **数据表**: `external_skills` (元数据), `authors` (作者信息)
- **同步策略**: 全量 upsert，自动更新 installs 数量
- **触发方式**: 需要配置 Cron Job 定时触发，或手动调用

### 数据关系

```
skills (本地原生)          external_skills (从 skills.sh 同步)
    ↓                              ↓
download_tokens (支持两种来源，通过 skill_type 区分)
```

## Development Rules

### 1. Testing Requirements

**Every new API endpoint or library function MUST have corresponding test cases.**

When implementing new features:
1. Create test file in `tests/api/` for API routes or `tests/lib/` for library functions
2. Cover at minimum:
   - Happy path (success cases)
   - Authentication/authorization cases
   - Error handling (404, 500, etc.)
   - Edge cases
3. Run `npm test` before considering the task complete
4. All tests must pass

Example test structure:
```
tests/
├── api/
│   ├── share.test.ts       # For /api/skills/[slug]/share
│   └── skills-slug.test.ts # For /api/skills/[slug]
└── lib/
    ├── download-token.test.ts
    └── git-pack.test.ts
```

### 2. API Design Patterns

- Use Supabase service role key for database operations
- Implement proper RLS policies in migrations
- Return consistent error responses: `{ error: 'code', message: 'description' }`
- Use `verifyToken` from `@/lib/auth-middleware` for authenticated endpoints

### 3. File Organization

- API routes: `src/app/api/[resource]/route.ts`
- Library utilities: `src/lib/[name].ts`
- Components: `src/components/[Name].tsx`
- Database migrations: `supabase/migrations/YYYYMMDD_[description].sql`

### 4. Commit Checklist

Before committing:
- [ ] `npm test` passes
- [ ] `npm run lint` passes (if applicable)
- [ ] New features have tests
- [ ] Database migrations are included if schema changed
