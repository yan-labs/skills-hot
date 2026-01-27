import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SNAPSHOT_LIMIT = 1000; // Top 1000 skills
const SURGE_THRESHOLD = 0.3; // 30% increase = surging

/**
 * GET /api/cron/save-snapshot
 * 保存技能快照，用于趋势追踪
 * 应在 sync-external-skills 之后调用
 */
export async function GET(request: Request) {
  // 验证请求来源：Cloudflare Cron 或 CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent') || '';
  const isCloudflareWorker = userAgent.includes('Cloudflare-Cron');

  if (
    !isCloudflareWorker &&
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
    // 快照时间（精确到小时）
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const snapshotAt = now.toISOString();

    // 1. 获取当前 Top 1000 技能
    const { data: currentSkills, error: fetchError } = await supabase
      .from('external_skills')
      .select('id, name, slug, github_owner, installs, stars')
      .order('installs', { ascending: false })
      .limit(SNAPSHOT_LIMIT);

    if (fetchError || !currentSkills) {
      console.error('Failed to fetch skills:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch current skills' },
        { status: 500 }
      );
    }

    // 2. 获取上一次快照（用于计算变化）
    const { data: lastSnapshot } = await supabase
      .from('skill_snapshots')
      .select('skill_name, rank, installs')
      .order('snapshot_at', { ascending: false })
      .limit(SNAPSHOT_LIMIT);

    // 构建上次快照的映射
    const lastSnapshotMap = new Map<string, { rank: number; installs: number }>();
    if (lastSnapshot) {
      for (const s of lastSnapshot) {
        lastSnapshotMap.set(s.skill_name, { rank: s.rank, installs: s.installs });
      }
    }

    // 当前技能名称集合（用于检测掉榜）
    const currentSkillNames = new Set(currentSkills.map(s => s.name));

    // 3. 准备快照记录
    const snapshotRecords = currentSkills.map((skill, index) => {
      const rank = index + 1;
      const lastData = lastSnapshotMap.get(skill.name);

      let rankDelta = 0;
      let installsDelta = 0;
      let installsRate = 0;
      let isNew = false;

      if (lastData) {
        // 排名变化（正数=上升）
        rankDelta = lastData.rank - rank;
        // 安装量变化
        installsDelta = skill.installs - lastData.installs;
        // 变化率
        if (lastData.installs > 0) {
          installsRate = installsDelta / lastData.installs;
        }
      } else {
        // 新晋技能
        isNew = true;
      }

      return {
        snapshot_at: snapshotAt,
        skill_id: skill.id,
        skill_name: skill.name,
        skill_slug: skill.slug,
        github_owner: skill.github_owner,
        rank,
        installs: skill.installs,
        stars: skill.stars || 0,
        rank_delta: rankDelta,
        installs_delta: installsDelta,
        installs_rate: Math.round(installsRate * 10000) / 10000, // 保留4位小数
        is_new: isNew,
        is_dropped: false,
      };
    });

    // 4. 检测掉榜的技能（上次在 Top 1000，这次不在）
    const droppedRecords: typeof snapshotRecords = [];
    if (lastSnapshot) {
      for (const lastSkill of lastSnapshot) {
        if (!currentSkillNames.has(lastSkill.skill_name)) {
          droppedRecords.push({
            snapshot_at: snapshotAt,
            skill_id: null as unknown as string, // 可能已被删除
            skill_name: lastSkill.skill_name,
            skill_slug: lastSkill.skill_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            github_owner: null,
            rank: lastSkill.rank, // 保留上次排名作为 previousRank
            installs: lastSkill.installs,
            stars: 0,
            rank_delta: 0,
            installs_delta: 0,
            installs_rate: 0,
            is_new: false,
            is_dropped: true,
          });
        }
      }
    }

    // 5. 合并并插入快照
    const allRecords = [...snapshotRecords, ...droppedRecords];

    // 分批插入（避免单次请求过大）
    const batchSize = 500;
    let insertedCount = 0;

    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      const { error: insertError, count } = await supabase
        .from('skill_snapshots')
        .upsert(batch, { onConflict: 'snapshot_at,skill_name', count: 'exact' });

      if (insertError) {
        console.error('Snapshot insert error:', insertError);
      } else {
        insertedCount += count || batch.length;
      }
    }

    // 6. 清理旧快照（保留 30 天）
    await supabase.rpc('cleanup_old_snapshots');

    // 7. 统计趋势数据
    const stats = {
      rising: snapshotRecords.filter(s => s.rank_delta > 0 && !s.is_new).length,
      declining: snapshotRecords.filter(s => s.rank_delta < 0).length,
      newEntries: snapshotRecords.filter(s => s.is_new).length,
      dropped: droppedRecords.length,
      surging: snapshotRecords.filter(s => s.installs_rate >= SURGE_THRESHOLD).length,
    };

    return NextResponse.json({
      success: true,
      snapshotAt,
      totalSkills: currentSkills.length,
      inserted: insertedCount,
      stats,
    });

  } catch (error) {
    console.error('Snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to save snapshot' },
      { status: 500 }
    );
  }
}
