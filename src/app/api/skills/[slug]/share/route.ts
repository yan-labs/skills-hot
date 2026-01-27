import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-middleware';
import {
  prepareTokenData,
  buildShortUrl,
  type TokenPurpose,
} from '@/lib/download-token';

type Props = {
  params: Promise<{ slug: string }>;
};

interface ShareRequestBody {
  expires_in?: number; // 秒，默认 600（10分钟）
  max_uses?: number; // 默认根据 purpose 决定
  purpose?: TokenPurpose; // 'git_clone' | 'tarball' | 'direct'
}


/**
 * POST /api/skills/[slug]/share
 * 生成短链接下载令牌
 *
 * Request body:
 * {
 *   "expires_in": 600,    // 秒，可选，默认 600（10分钟），最大 3600
 *   "max_uses": 5,        // 可选，默认 5（Git clone）或 1（直接下载）
 *   "purpose": "git_clone" // 可选，'git_clone' | 'tarball' | 'direct'
 * }
 *
 * Response:
 * {
 *   "short_url": "https://skills.hot/g/x7Kp2Q",
 *   "git_url": "https://skills.hot/g/x7Kp2Q.git",
 *   "tarball_url": "https://skills.hot/g/x7Kp2Q/archive.tar.gz",
 *   "clone_command": "git clone https://skills.hot/g/x7Kp2Q.git skill-name",
 *   "expires_at": "2025-01-30T12:30:00Z",
 *   "max_uses": 5
 * }
 *
 * 权限说明：
 * - 公开技能：任何人都可以生成（匿名或登录用户）
 * - 私有技能：只有所有者或有 download/full 权限的用户可以生成
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { slug } = await params;

    // 1. 尝试验证用户身份（可选）
    const authHeader = request.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);
    const currentUser = authResult.user;

    // 2. 解析请求体
    let body: ShareRequestBody = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // 允许空请求体，使用默认值
    }

    const purpose: TokenPurpose = body.purpose || 'git_clone';

    // 3. 初始化 Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 4. 查找技能（先查本地 skills，再查 external_skills）
    let skill: {
      id: string;
      slug: string;
      name: string;
      is_private: boolean;
      user_id: string | null;
      has_files: boolean;
      source: 'local' | 'external';
    } | null = null;

    // 先查本地 skills 表
    const { data: localSkill } = await supabase
      .from('skills')
      .select('id, slug, name, is_private, user_id, has_files')
      .eq('slug', slug)
      .single();

    if (localSkill) {
      skill = { ...localSkill, source: 'local' as const };
    } else {
      // 再查 external_skills 表
      const { data: externalSkill } = await supabase
        .from('external_skills')
        .select('id, slug, name')
        .eq('slug', slug)
        .single();

      if (!externalSkill) {
        // 最后尝试用 name 匹配 external_skills
        const { data: externalByName } = await supabase
          .from('external_skills')
          .select('id, slug, name')
          .eq('name', slug)
          .single();

        if (externalByName) {
          skill = {
            id: externalByName.id,
            slug: externalByName.slug,
            name: externalByName.name,
            is_private: false,
            user_id: null,
            has_files: false,
            source: 'external' as const,
          };
        }
      } else {
        skill = {
          id: externalSkill.id,
          slug: externalSkill.slug,
          name: externalSkill.name,
          is_private: false,
          user_id: null,
          has_files: false,
          source: 'external' as const,
        };
      }
    }

    if (!skill) {
      return NextResponse.json(
        { error: 'not_found', message: 'Skill not found' },
        { status: 404 }
      );
    }

    // 5. 检查权限
    // - 公开技能：任何人都可以生成
    // - 私有技能：必须登录且有权限
    if (skill.is_private) {
      // 私有技能必须登录
      if (!currentUser) {
        return NextResponse.json(
          {
            error: 'unauthorized',
            message: 'Authentication required for private skills',
          },
          { status: 401 }
        );
      }

      // 检查权限
      if (skill.user_id !== currentUser.id) {
        const { data: access } = await supabase
          .from('skill_access')
          .select('access_type')
          .eq('skill_id', skill.id)
          .eq('user_id', currentUser.id)
          .or('expires_at.is.null,expires_at.gt.now()')
          .single();

        if (!access || access.access_type === 'view') {
          return NextResponse.json(
            {
              error: 'forbidden',
              message: 'You do not have permission to share this skill',
            },
            { status: 403 }
          );
        }
      }
    }

    // 6. 确定用户 ID（登录用户或匿名）
    const userId = currentUser?.id || null;

    // 7. 准备令牌数据
    const tokenData = await prepareTokenData({
      skillId: skill.id,
      userId: userId,
      expiresIn: body.expires_in,
      maxUses: body.max_uses,
      purpose,
      clientInfo: {
        userAgent: request.headers.get('User-Agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      },
    });

    // 8. 存储令牌（根据来源决定用哪个字段）
    const tokenRecord: Record<string, unknown> = {
      short_code: tokenData.shortCode,
      token_hash: tokenData.tokenHash,
      user_id: userId,
      expires_at: tokenData.expiresAt.toISOString(),
      max_uses: tokenData.maxUses,
      purpose,
      skill_type: skill.source,
      client_info: {
        userAgent: request.headers.get('User-Agent'),
        anonymous: !currentUser,
      },
    };

    // 根据来源设置正确的外键
    if (skill.source === 'local') {
      tokenRecord.skill_id = skill.id;
    } else {
      tokenRecord.external_skill_id = skill.id;
    }

    const { error: insertError } = await supabase.from('download_tokens').insert(tokenRecord);

    if (insertError) {
      console.error('Failed to create download token:', insertError);
      return NextResponse.json(
        { error: 'server_error', message: 'Failed to create share link' },
        { status: 500 }
      );
    }

    // 8. 构建并返回链接
    const urls = buildShortUrl(tokenData.shortCode);

    return NextResponse.json({
      short_url: urls.shortUrl,
      git_url: urls.gitUrl,
      tarball_url: urls.tarballUrl,
      clone_command: `git clone ${urls.gitUrl} ${skill.slug}`,
      npx_command: `npx skills add ${urls.gitUrl.replace('https://', '')}`,
      expires_at: tokenData.expiresAt.toISOString(),
      max_uses: tokenData.maxUses,
      skill: {
        slug: skill.slug,
        name: skill.name,
      },
    });
  } catch (error) {
    console.error('Share API error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

/**
 * GET /api/skills/[slug]/share
 * 获取当前用户为该技能创建的活跃分享链接
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { slug } = await params;

    // 验证用户身份
    const authHeader = request.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);

    if (!authResult.user) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 获取技能 ID
    const { data: skill } = await supabase
      .from('skills')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!skill) {
      return NextResponse.json(
        { error: 'not_found', message: 'Skill not found' },
        { status: 404 }
      );
    }

    // 获取用户的活跃令牌
    const { data: tokens } = await supabase
      .from('download_tokens')
      .select('short_code, expires_at, max_uses, use_count, purpose, created_at')
      .eq('skill_id', skill.id)
      .eq('user_id', authResult.user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    const activeTokens = (tokens || []).map((token) => {
      const urls = buildShortUrl(token.short_code);
      return {
        short_url: urls.shortUrl,
        git_url: urls.gitUrl,
        tarball_url: urls.tarballUrl,
        expires_at: token.expires_at,
        max_uses: token.max_uses,
        remaining_uses: token.max_uses - token.use_count,
        purpose: token.purpose,
        created_at: token.created_at,
      };
    });

    return NextResponse.json({ tokens: activeTokens });
  } catch (error) {
    console.error('Get share links error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
