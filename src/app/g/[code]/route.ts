import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidShortCode } from '@/lib/download-token';

type Props = {
  params: Promise<{ code: string }>;
};

/**
 * GET /g/{code}
 * 短链接入口 - 重定向到技能页面或处理基本 Git 请求
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { code } = await params;

    // 清理短码（移除 .git 后缀）
    const shortCode = code.replace(/\.git$/, '');

    if (!isValidShortCode(shortCode)) {
      return new NextResponse('Invalid link', { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new NextResponse('Server error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 查找令牌对应的技能
    const { data: token } = await supabase
      .from('download_tokens')
      .select(
        `
        skill_id,
        expires_at,
        use_count,
        max_uses,
        skill:skills(slug, name)
      `
      )
      .eq('short_code', shortCode)
      .single();

    if (!token) {
      return new NextResponse('Link not found or expired', { status: 404 });
    }

    // 检查是否过期
    if (new Date(token.expires_at) < new Date()) {
      return new NextResponse('Link has expired', { status: 410 });
    }

    // 检查使用次数
    if (token.use_count >= token.max_uses) {
      return new NextResponse('Link usage limit exceeded', { status: 410 });
    }

    // 如果是浏览器访问（Accept: text/html），重定向到技能页面
    const acceptHeader = request.headers.get('Accept') || '';
    if (acceptHeader.includes('text/html')) {
      const skill = token.skill as { slug: string; name: string } | null;
      if (skill?.slug) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://skillbank.dev';
        return NextResponse.redirect(`${siteUrl}/skills/${skill.slug}`);
      }
    }

    // 否则返回简单的信息
    return NextResponse.json({
      message: 'Use git clone or download the tarball',
      git_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://skillbank.dev'}/g/${shortCode}.git`,
      tarball_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://skillbank.dev'}/g/${shortCode}/archive.tar.gz`,
    });
  } catch (error) {
    console.error('Short link error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
