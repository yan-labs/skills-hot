import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_code } = body;

    if (!user_code) {
      return NextResponse.json(
        { error: 'User code is required' },
        { status: 400 }
      );
    }

    // 格式化 user_code（移除破折号，转大写）
    const formattedCode = user_code.toUpperCase().replace(/-/g, '');
    const normalizedCode = `${formattedCode.slice(0, 4)}-${formattedCode.slice(4)}`;

    // 创建 Supabase 客户端获取当前用户
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 获取当前登录用户
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // 这里不需要设置 cookie
        },
      },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Please sign in to authorize' },
        { status: 401 }
      );
    }

    // 使用 service role 查询和更新 device_codes
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 查找设备码
    const { data: deviceData, error: fetchError } = await supabaseAdmin
      .from('device_codes')
      .select('*')
      .eq('user_code', normalizedCode)
      .eq('status', 'pending')
      .single();

    if (fetchError || !deviceData) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Please check and try again.' },
        { status: 400 }
      );
    }

    // 检查是否过期
    if (new Date(deviceData.expires_at) < new Date()) {
      await supabaseAdmin
        .from('device_codes')
        .update({ status: 'expired' })
        .eq('id', deviceData.id);

      return NextResponse.json(
        { error: 'This code has expired. Please generate a new one from your CLI.' },
        { status: 400 }
      );
    }

    // 授权设备码
    const { error: updateError } = await supabaseAdmin
      .from('device_codes')
      .update({
        user_id: user.id,
        status: 'authorized',
        authorized_at: new Date().toISOString(),
      })
      .eq('id', deviceData.id);

    if (updateError) {
      console.error('Failed to authorize device:', updateError);
      return NextResponse.json(
        { error: 'Failed to authorize device' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      client_info: deviceData.client_info,
    });
  } catch (error) {
    console.error('Authorize error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
