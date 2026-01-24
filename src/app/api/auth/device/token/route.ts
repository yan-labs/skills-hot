import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


// 生成访问令牌（使用 Web Crypto API）
function generateAccessToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(64);
  globalThis.crypto.getRandomValues(array);
  return 'sb_' + Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

// 计算令牌哈希（使用 Web Crypto API）
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_code } = body;

    if (!device_code) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'device_code is required' },
        { status: 400 }
      );
    }

    // 创建 Supabase 服务端客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'server_error', error_description: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 查询设备码状态
    const { data: deviceData, error: fetchError } = await supabase
      .from('device_codes')
      .select('*')
      .eq('device_code', device_code)
      .single();

    if (fetchError || !deviceData) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid device code' },
        { status: 400 }
      );
    }

    // 检查是否过期
    if (new Date(deviceData.expires_at) < new Date()) {
      // 更新状态为过期
      await supabase
        .from('device_codes')
        .update({ status: 'expired' })
        .eq('id', deviceData.id);

      return NextResponse.json(
        { error: 'expired_token', error_description: 'Device code has expired' },
        { status: 400 }
      );
    }

    // 根据状态返回不同响应
    switch (deviceData.status) {
      case 'pending':
        // 用户尚未授权，继续轮询
        return NextResponse.json(
          { error: 'authorization_pending', error_description: 'Waiting for user authorization' },
          { status: 400 }
        );

      case 'authorized':
        // 用户已授权，生成访问令牌
        const accessToken = generateAccessToken();
        const tokenHash = await hashToken(accessToken);

        // 获取用户信息
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
          deviceData.user_id
        );

        if (userError || !userData.user) {
          return NextResponse.json(
            { error: 'server_error', error_description: 'Failed to get user info' },
            { status: 500 }
          );
        }

        // 创建 CLI 令牌记录
        const { error: tokenError } = await supabase.from('cli_tokens').insert({
          user_id: deviceData.user_id,
          token_hash: tokenHash,
          name: deviceData.client_info?.device_name || 'CLI',
          client_info: deviceData.client_info,
        });

        if (tokenError) {
          console.error('Failed to create CLI token:', tokenError);
          return NextResponse.json(
            { error: 'server_error', error_description: 'Failed to create access token' },
            { status: 500 }
          );
        }

        // 标记设备码为已使用
        await supabase
          .from('device_codes')
          .update({ status: 'used' })
          .eq('id', deviceData.id);

        // 返回访问令牌
        return NextResponse.json({
          access_token: accessToken,
          token_type: 'Bearer',
          user: {
            id: userData.user.id,
            email: userData.user.email,
            name: userData.user.user_metadata?.name || userData.user.email?.split('@')[0],
          },
        });

      case 'expired':
        return NextResponse.json(
          { error: 'expired_token', error_description: 'Device code has expired' },
          { status: 400 }
        );

      case 'used':
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Device code has already been used' },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { error: 'server_error', error_description: 'Unknown device code status' },
          { status: 500 }
        );
    }
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
