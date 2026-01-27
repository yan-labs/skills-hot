import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 只支持 view 和 copy
const VALID_EVENTS = ['view', 'copy'] as const;
type EventType = (typeof VALID_EVENTS)[number];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const eventType = (body.event || body.event_type) as EventType;
    const skillSlug = body.skill || body.skill_slug;

    if (!eventType || !VALID_EVENTS.includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type, must be view or copy' },
        { status: 400 }
      );
    }

    if (!skillSlug) {
      return NextResponse.json(
        { error: 'Missing skill slug' },
        { status: 400 }
      );
    }

    // 使用 service role key 调用 increment_stat
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration missing');
      return NextResponse.json({ success: true }); // 静默失败
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 先通过 slug 查找 skill_id
    const { data: skill } = await supabase
      .from('skills')
      .select('id')
      .eq('slug', skillSlug)
      .single();

    if (!skill) {
      // 技能不存在，静默忽略（可能是外部技能）
      return NextResponse.json({ success: true });
    }

    // 递增统计：view -> views, copy -> copies
    const column = eventType === 'view' ? 'views' : 'copies';
    await supabase.rpc('increment_stat', {
      p_skill_id: skill.id,
      p_column: column,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Stats API error:', error);
    // 统计失败不应影响用户体验，静默返回成功
    return NextResponse.json({ success: true });
  }
}
