import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SNAPSHOT_LIMIT = 1000; // Top 1000 skills
const SURGE_THRESHOLD = 0.3; // 30% increase = surging

type SnapshotRecord = {
  snapshot_at: string;
  skill_id: string | null;
  skill_name: string;
  skill_slug: string;
  github_owner: string | null;
  rank: number;
  installs: number;
  stars: number;
  views: number;
  copies: number;
  rank_delta: number;
  installs_delta: number;
  views_delta: number;
  copies_delta: number;
  installs_rate: number;
  is_new: boolean;
  is_dropped: boolean;
};

type LastSnapshotData = {
  rank: number;
  installs: number;
  views: number;
  copies: number;
};

/**
 * GET /api/cron/save-snapshot
 * 保存技能快照，用于趋势追踪
 * 包含 external_skills 和本地 skills 的统计数据
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

    // 1. 获取 external_skills（GitHub 技能）
    const { data: externalSkills, error: externalError } = await supabase
      .from('external_skills')
      .select('id, name, slug, github_owner, installs, stars')
      .order('installs', { ascending: false })
      .limit(SNAPSHOT_LIMIT);

    if (externalError) {
      console.error('Failed to fetch external skills:', externalError);
    }

    // 2. 获取本地 skills（带统计数据）
    const { data: localSkills, error: localError } = await supabase
      .from('skills')
      .select('id, name, slug, author, skill_stats(installs, views, copies)')
      .eq('is_private', false)
      .order('created_at', { ascending: false });

    if (localError) {
      console.error('Failed to fetch local skills:', localError);
    }

    // 3. 合并所有技能并按安装量排序
    type SkillData = {
      id: string;
      name: string;
      slug: string;
      github_owner: string | null;
      installs: number;
      stars: number;
      views: number;
      copies: number;
      source: 'external' | 'local';
    };

    const allSkills: SkillData[] = [];

    // 添加 external skills
    if (externalSkills) {
      for (const skill of externalSkills) {
        allSkills.push({
          id: skill.id,
          name: skill.name,
          slug: skill.slug,
          github_owner: skill.github_owner,
          installs: skill.installs || 0,
          stars: skill.stars || 0,
          views: 0, // external skills 没有 views
          copies: 0, // external skills 没有 copies
          source: 'external',
        });
      }
    }

    // 添加 local skills
    if (localSkills) {
      for (const skill of localSkills) {
        const statsArray = skill.skill_stats as Array<{ installs: number; views: number; copies: number }> | null;
        const stats = statsArray?.[0] || null;
        allSkills.push({
          id: skill.id,
          name: skill.name,
          slug: skill.slug,
          github_owner: skill.author,
          installs: stats?.installs || 0,
          stars: 0,
          views: stats?.views || 0,
          copies: stats?.copies || 0,
          source: 'local',
        });
      }
    }

    // 按安装量排序并截取 Top 1000
    allSkills.sort((a, b) => b.installs - a.installs);
    const topSkills = allSkills.slice(0, SNAPSHOT_LIMIT);

    // 4. 获取上一次快照（用于计算变化）
    const { data: lastSnapshot } = await supabase
      .from('skill_snapshots')
      .select('skill_name, rank, installs, views, copies')
      .order('snapshot_at', { ascending: false })
      .limit(SNAPSHOT_LIMIT);

    // 构建上次快照的映射
    const lastSnapshotMap = new Map<string, LastSnapshotData>();
    if (lastSnapshot) {
      for (const s of lastSnapshot) {
        lastSnapshotMap.set(s.skill_name, {
          rank: s.rank,
          installs: s.installs,
          views: s.views || 0,
          copies: s.copies || 0,
        });
      }
    }

    // 当前技能名称集合（用于检测掉榜）
    const currentSkillNames = new Set(topSkills.map(s => s.name));

    // 5. 准备快照记录
    const snapshotRecords: SnapshotRecord[] = topSkills.map((skill, index) => {
      const rank = index + 1;
      const lastData = lastSnapshotMap.get(skill.name);

      let rankDelta = 0;
      let installsDelta = 0;
      let viewsDelta = 0;
      let copiesDelta = 0;
      let installsRate = 0;
      let isNew = false;

      if (lastData) {
        rankDelta = lastData.rank - rank;
        installsDelta = skill.installs - lastData.installs;
        viewsDelta = skill.views - lastData.views;
        copiesDelta = skill.copies - lastData.copies;
        if (lastData.installs > 0) {
          installsRate = installsDelta / lastData.installs;
        }
      } else {
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
        stars: skill.stars,
        views: skill.views,
        copies: skill.copies,
        rank_delta: rankDelta,
        installs_delta: installsDelta,
        views_delta: viewsDelta,
        copies_delta: copiesDelta,
        installs_rate: Math.round(installsRate * 10000) / 10000,
        is_new: isNew,
        is_dropped: false,
      };
    });

    // 6. 检测掉榜的技能
    const droppedRecords: SnapshotRecord[] = [];
    if (lastSnapshot) {
      for (const lastSkill of lastSnapshot) {
        if (!currentSkillNames.has(lastSkill.skill_name)) {
          droppedRecords.push({
            snapshot_at: snapshotAt,
            skill_id: null,
            skill_name: lastSkill.skill_name,
            skill_slug: lastSkill.skill_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            github_owner: null,
            rank: lastSkill.rank,
            installs: lastSkill.installs,
            stars: 0,
            views: lastSkill.views || 0,
            copies: lastSkill.copies || 0,
            rank_delta: 0,
            installs_delta: 0,
            views_delta: 0,
            copies_delta: 0,
            installs_rate: 0,
            is_new: false,
            is_dropped: true,
          });
        }
      }
    }

    // 7. 合并并插入快照
    const allRecords = [...snapshotRecords, ...droppedRecords];

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

    // 8. 清理旧快照（保留 30 天）
    await supabase.rpc('cleanup_old_snapshots');

    // 9. 统计趋势数据
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
      totalSkills: topSkills.length,
      externalCount: externalSkills?.length || 0,
      localCount: localSkills?.length || 0,
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
