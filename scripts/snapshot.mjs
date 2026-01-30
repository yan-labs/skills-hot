#!/usr/bin/env node
/**
 * 技能快照脚本（本地执行版本）
 *
 * 用法: node scripts/snapshot.mjs
 *
 * 功能:
 * - 快照当前 Top 1000 技能排名
 * - 计算与上次快照的变化（排名、安装量）
 * - 标记新晋、掉榜、暴涨技能
 * - 清理 30 天以上的旧快照
 *
 * 环境变量:
 * - SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const SNAPSHOT_LIMIT = 1000;
const SURGE_THRESHOLD = 0.2;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 需要设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('📸 技能快照生成\n');

  const startTime = Date.now();

  // 快照时间（精确到小时）
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const snapshotAt = now.toISOString();

  console.log(`🕐 快照时间: ${snapshotAt}`);

  // 1. 获取 external_skills
  console.log('\n📥 获取 external_skills...');
  const { data: externalSkills, error: externalError } = await supabase
    .from('external_skills')
    .select('id, name, slug, github_owner, installs, stars')
    .order('installs', { ascending: false })
    .limit(SNAPSHOT_LIMIT);

  if (externalError) {
    console.error('❌ 获取 external_skills 失败:', externalError);
  }
  console.log(`   ✅ ${externalSkills?.length || 0} 条`);

  // 2. 获取本地 skills
  console.log('📥 获取本地 skills...');
  const { data: localSkills, error: localError } = await supabase
    .from('skills')
    .select('id, name, slug, author, skill_stats(installs, views, copies)')
    .eq('is_private', false)
    .order('created_at', { ascending: false });

  if (localError) {
    console.error('❌ 获取本地 skills 失败:', localError);
  }
  console.log(`   ✅ ${localSkills?.length || 0} 条`);

  // 3. 合并所有技能并按安装量排序
  const allSkills = [];

  if (externalSkills) {
    for (const skill of externalSkills) {
      allSkills.push({
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        github_owner: skill.github_owner,
        installs: skill.installs || 0,
        stars: skill.stars || 0,
        views: 0,
        copies: 0,
        source: 'external',
      });
    }
  }

  if (localSkills) {
    for (const skill of localSkills) {
      const statsArray = skill.skill_stats || [];
      const stats = Array.isArray(statsArray) ? statsArray[0] : null;
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

  // 去重：同名的技能保留安装量更高的（避免 upsert 冲突）
  const skillsMap = new Map();
  for (const skill of allSkills) {
    const existing = skillsMap.get(skill.name);
    if (!existing || skill.installs > existing.installs) {
      skillsMap.set(skill.name, skill);
    }
  }

  // 按安装量排序
  const topSkills = Array.from(skillsMap.values())
    .sort((a, b) => b.installs - a.installs)
    .slice(0, SNAPSHOT_LIMIT);

  console.log(`\n📊 合并后 Top ${topSkills.length} 技能`);

  // 4. 获取上一次快照（只取最新的一个快照时间）
  console.log('\n📂 获取上次快照...');
  const lastSnapshotMap = new Map();

  // 先获取最新的快照时间
  const { data: latestSnapshot } = await supabase
    .from('skill_snapshots')
    .select('snapshot_at')
    .order('snapshot_at', { ascending: false })
    .limit(1);

  if (!latestSnapshot || latestSnapshot.length === 0) {
    console.log('   ℹ️  首次运行，无历史数据');
  } else {
    const lastSnapshotTime = latestSnapshot[0].snapshot_at;
    console.log(`   📅 上次快照时间: ${lastSnapshotTime}`);
    // 获取该快照时间下的所有记录
    const { data: lastSnapshot } = await supabase
      .from('skill_snapshots')
      .select('skill_name, rank, installs, views, copies')
      .eq('snapshot_at', lastSnapshotTime);

    if (lastSnapshot) {
      for (const s of lastSnapshot) {
        lastSnapshotMap.set(s.skill_name, {
          rank: s.rank,
          installs: s.installs,
          views: s.views || 0,
          copies: s.copies || 0,
        });
      }
      console.log(`   ✅ 上次快照有 ${lastSnapshot.length} 条记录`);
    }
  }

  // 当前技能名称集合
  const currentSkillNames = new Set(topSkills.map(s => s.name));

  // 5. 准备快照记录
  console.log('\n💾 生成快照记录...');

  const snapshotRecords = topSkills.map((skill, index) => {
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
  const droppedRecords = [];
  if (lastSnapshotMap.size > 0) {
    for (const [skillName, lastData] of lastSnapshotMap.entries()) {
      if (!currentSkillNames.has(skillName)) {
        droppedRecords.push({
          snapshot_at: snapshotAt,
          skill_id: null,
          skill_name: skillName,
          skill_slug: skillName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          github_owner: null,
          rank: lastData.rank,
          installs: lastData.installs,
          stars: 0,
          views: lastData.views || 0,
          copies: lastData.copies || 0,
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

  // 7. 清理当前快照时间的旧记录（避免 upsert 冲突）
  console.log('\n🧹 清理当前快照时间的旧记录...');
  const { error: deleteError } = await supabase
    .from('skill_snapshots')
    .delete()
    .eq('snapshot_at', snapshotAt);
  if (deleteError) {
    console.error('   ⚠️ 清理旧记录失败:', deleteError.message);
  } else {
    console.log('   ✅ 清理完成');
  }

  // 8. 合并并插入快照
  let allRecords = [...snapshotRecords, ...droppedRecords];

  // 最终去重：确保同名的技能只保留一条（dropped 优先于 snapshot，因为掉榜是最终状态）
  const finalRecordsMap = new Map();
  for (const record of allRecords) {
    const existing = finalRecordsMap.get(record.skill_name);
    // 如果已存在，优先保留 is_dropped 的记录（掉榜是最终状态）
    if (!existing || (record.is_dropped && !existing.is_dropped)) {
      finalRecordsMap.set(record.skill_name, record);
    }
  }
  allRecords = Array.from(finalRecordsMap.values());

  console.log(`\n💾 ${allRecords.length} 条记录（去重后）`);

  const batchSize = 500;
  let insertedCount = 0;

  for (let i = 0; i < allRecords.length; i += batchSize) {
    const batch = allRecords.slice(i, i + batchSize);
    const { error, count } = await supabase
      .from('skill_snapshots')
      .upsert(batch, { onConflict: 'snapshot_at,skill_name', ignoreDuplicates: false });

    if (error) {
      console.error(`   ⚠️ Batch ${Math.floor(i / batchSize) + 1} 插入错误:`, error.message);
    } else {
      insertedCount += count || batch.length;
    }
  }

  console.log(`   ✅ 插入 ${insertedCount} 条`);

  // 9. 清理旧快照
  console.log('\n🧹 清理 30 天前的旧快照...');
  try {
    await supabase.rpc('cleanup_old_snapshots');
    console.log('   ✅ 清理完成');
  } catch (error) {
    console.error('   ⚠️ 清理失败（可能需要创建 RPC 函数）:', error.message);
  }

  // 9. 统计趋势数据
  const stats = {
    rising: snapshotRecords.filter(s => s.rank_delta > 0 && !s.is_new).length,
    declining: snapshotRecords.filter(s => s.rank_delta < 0).length,
    newEntries: snapshotRecords.filter(s => s.is_new).length,
    dropped: droppedRecords.length,
    surging: snapshotRecords.filter(s => s.installs_rate >= SURGE_THRESHOLD).length,
  };

  // 完成
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n🎉 快照完成!');
  console.log(`   耗时: ${elapsed}s`);
  console.log(`   技能总数: ${topSkills.length}`);
  console.log(`   插入记录: ${insertedCount}`);
  console.log(`\n📈 趋势统计:`);
  console.log(`   Rising: ${stats.rising}`);
  console.log(`   Declining: ${stats.declining}`);
  console.log(`   New: ${stats.newEntries}`);
  console.log(`   Dropped: ${stats.dropped}`);
  console.log(`   Surging: ${stats.surging}`);
}

main().catch(err => {
  console.error('❌ 快照失败:', err);
  process.exit(1);
});
