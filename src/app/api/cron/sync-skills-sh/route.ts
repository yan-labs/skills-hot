import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SKILLS_SH_API = 'https://skills.sh/api/skills?limit=50000';

interface SkillsShSkill {
  id: string;
  name: string;
  installs: number;
  topSource: string;
}

/**
 * GET /api/cron/sync-skills-sh
 * 同步 skills.sh 数据到本地缓存表
 * 用于 Vercel Cron 定时调用或手动触发
 */
export async function GET(request: Request) {
  // 验证 Cron 密钥（如果配置了）
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. 拉取 skills.sh 全量数据
    const response = await fetch(SKILLS_SH_API, {
      headers: {
        'User-Agent': 'SkillsHot/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `skills.sh API error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!data.skills || !Array.isArray(data.skills)) {
      return NextResponse.json(
        { error: 'Invalid response from skills.sh' },
        { status: 502 }
      );
    }

    // 2. 转换为 upsert 格式
    const records = data.skills.map((s: SkillsShSkill) => ({
      name: s.name,
      installs: s.installs || 0,
      top_source: s.topSource || null,
      synced_at: new Date().toISOString(),
    }));

    // 3. 批量 upsert（每批 1000 条，避免超时）
    const batchSize = 1000;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from('skills_sh_cache')
        .upsert(batch, { onConflict: 'name' });

      if (error) {
        console.error('Upsert error:', error);
        errors++;
      } else {
        inserted += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      total: data.skills.length,
      inserted,
      errors,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync skills.sh data' },
      { status: 500 }
    );
  }
}
