import { NextRequest, NextResponse } from 'next/server';


// 支持的事件类型
const VALID_EVENTS = ['view', 'copy', 'install', 'update', 'remove', 'search'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 支持两种格式：
    // 旧格式（网页）: { skill_slug, skill_id, event_type }
    // 新格式（CLI）: { event, skill, query, results, timestamp, ... }
    const eventType = body.event || body.event_type;
    const skillSlug = body.skill || body.skill_slug;

    if (!eventType) {
      return NextResponse.json(
        { error: 'Missing event type' },
        { status: 400 }
      );
    }

    if (!VALID_EVENTS.includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // 对于非搜索事件，需要 skill 标识
    if (eventType !== 'search' && !skillSlug) {
      return NextResponse.json(
        { error: 'Missing skill identifier' },
        { status: 400 }
      );
    }

    // TODO: 重新实现 Analytics Engine 集成
    // 目前暂时禁用以修复 getCloudflareContext 导入问题

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
