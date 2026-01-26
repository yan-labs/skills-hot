# Supabase Migration via Edge Function

当 Supabase CLI 无法直连数据库（代理、防火墙等原因）时，可以通过 Edge Function 执行 SQL 迁移。

## 适用场景

- `npx supabase db push` 报 TLS/连接错误
- 代理软件拦截了数据库端口（5432/6543）
- 无法访问 Supabase Dashboard

## 步骤

### 1. 创建临时 Edge Function

```bash
mkdir -p supabase/functions/run-migration

cat > supabase/functions/run-migration/index.ts << 'EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_DB_URL not set' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }

  const sql = postgres(dbUrl, { max: 1 })

  try {
    const { query } = await req.json()
    const result = await sql.unsafe(query)
    await sql.end()

    return new Response(
      JSON.stringify({ success: true, rowCount: result.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    await sql.end()
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
EOF
```

### 2. 部署 Edge Function

```bash
npx supabase functions deploy run-migration
```

### 3. 执行迁移

```bash
# 设置变量
URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2)
KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2)

# 执行迁移文件
MIGRATION=$(cat supabase/migrations/YOUR_MIGRATION.sql | jq -Rs .)

curl -s "$URL/functions/v1/run-migration" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $MIGRATION}"
```

### 4. 清理

```bash
npx supabase functions delete run-migration
rm -rf supabase/functions/run-migration
```

## 原理

Edge Function 运行在 Supabase 的基础设施内部，可以通过内置的 `SUPABASE_DB_URL` 环境变量直连数据库，绕过外部网络限制。

## 注意事项

- 这是临时方案，用完即删
- 大型迁移可能超时，需要拆分执行
- 确保迁移 SQL 是幂等的（使用 `IF NOT EXISTS` 等）
