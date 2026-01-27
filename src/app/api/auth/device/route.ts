import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


// 生成随机字符串（使用 Web Crypto API）
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

// 生成用户友好的短码 (格式: XXXX-XXXX)
function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
  const array = new Uint8Array(8);
  globalThis.crypto.getRandomValues(array);
  const code = Array.from(array, (byte) => chars[byte % chars.length]).join('');
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function POST(request: NextRequest) {
  try {
    // 解析客户端信息
    let clientInfo = {};
    try {
      const body = await request.json();
      clientInfo = body.client_info || {};
    } catch {
      // 允许空请求体
    }

    // 创建 Supabase 服务端客户端（使用 service role key 绕过 RLS）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 生成设备码和用户码
    const deviceCode = generateRandomString(40);
    const userCode = generateUserCode();

    // 设置过期时间（15 分钟）
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // 插入数据库
    const { error } = await supabase.from('device_codes').insert({
      device_code: deviceCode,
      user_code: userCode,
      client_info: clientInfo,
      status: 'pending',
      expires_at: expiresAt,
    });

    if (error) {
      console.error('Failed to create device code:', error);
      return NextResponse.json(
        { error: 'Failed to create device code' },
        { status: 500 }
      );
    }

    // 返回设备授权信息
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://skills.hot';

    return NextResponse.json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: `${baseUrl}/auth/device`,
      verification_uri_complete: `${baseUrl}/auth/device?code=${userCode}`,
      expires_in: 900, // 15 分钟（秒）
      interval: 5, // 建议轮询间隔（秒）
    });
  } catch (error) {
    console.error('Device auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
