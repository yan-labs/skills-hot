import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/skills/[slug]/history
 * 获取技能的历史统计数据（用于绘制趋势曲线图）
 *
 * Query params:
 *   - days: 天数（默认 30，最大 90）
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get('days') || '30'), 90);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 先通过 slug 找到技能名称
    // 检查本地 skills
    const { data: localSkill } = await supabase
      .from('skills')
      .select('name')
      .eq('slug', slug)
      .single();

    // 检查 external_skills（优先 skills.sh 来源）
    const { data: externalSkills } = await supabase
      .from('external_skills')
      .select('name')
      .eq('slug', slug)
      .order('source', { ascending: false })
      .limit(1);

    const externalSkill = externalSkills?.[0];

    const skillName = localSkill?.name || externalSkill?.name;

    if (!skillName) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    // 调用数据库函数获取历史数据
    const { data, error } = await supabase.rpc('get_skill_stats_history', {
      p_skill_name: skillName,
      p_days: days,
    });

    if (error) {
      console.error('History fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      skill: skillName,
      slug,
      days,
      history: data || [],
    });

  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
