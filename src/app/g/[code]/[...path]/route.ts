import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidShortCode } from '@/lib/download-token';
import {
  createGitPack,
  generateInfoRefs,
  generateSmartInfoRefs,
  generateHead,
  getObject,
  parseObjectPath,
  parseUploadPackRequest,
  generateUploadPackResponse,
  type GitPack,
} from '@/lib/git-pack';

type Props = {
  params: Promise<{ code: string; path: string[] }>;
};

// 缓存 Git pack（短期内存缓存，避免重复生成）
const packCache = new Map<string, { pack: GitPack; expiresAt: number }>();
const CACHE_TTL = 60 * 1000; // 1 分钟

function getCachedPack(key: string): GitPack | null {
  const cached = packCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.pack;
  }
  packCache.delete(key);
  return null;
}

function setCachedPack(key: string, pack: GitPack): void {
  // 清理过期缓存
  for (const [k, v] of packCache.entries()) {
    if (v.expiresAt < Date.now()) {
      packCache.delete(k);
    }
  }

  // 限制缓存大小
  if (packCache.size > 100) {
    const oldestKey = packCache.keys().next().value;
    if (oldestKey) {
      packCache.delete(oldestKey);
    }
  }

  packCache.set(key, { pack, expiresAt: Date.now() + CACHE_TTL });
}

/**
 * GET /g/{code}.git/{...path}
 * Git Dumb HTTP Protocol implementation
 *
 * 支持的端点:
 * - /info/refs - 返回 refs 列表
 * - /HEAD - 返回 HEAD 指向
 * - /objects/xx/xxxxx... - 返回 Git 对象
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { code, path: pathParts } = await params;

    // 清理短码
    const shortCode = code.replace(/\.git$/, '');
    const gitPath = pathParts.join('/');

    if (!isValidShortCode(shortCode)) {
      return new NextResponse('Invalid link', { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new NextResponse('Server error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 速率限制检查
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const { data: rateLimit } = await supabase.rpc('check_rate_limit', {
      p_ip_address: clientIp,
      p_endpoint: 'git_clone',
      p_max_requests: 30, // 每分钟 30 次请求（Git clone 会发多个请求）
      p_window_seconds: 60,
    });

    if (rateLimit && !rateLimit[0]?.allowed) {
      return new NextResponse('Rate limit exceeded', {
        status: 429,
        headers: {
          'Retry-After': '60',
        },
      });
    }

    // 使用令牌（原子操作，防止竞态）
    const { data: tokenResult } = await supabase.rpc('use_download_token', {
      p_short_code: shortCode,
      p_client_ip: clientIp,
    });

    if (!tokenResult?.[0]?.success) {
      const errorCode = tokenResult?.[0]?.error_code || 'invalid';
      const statusMap: Record<string, number> = {
        not_found: 404,
        expired: 410,
        exhausted: 410,
      };
      return new NextResponse(`Token ${errorCode}`, {
        status: statusMap[errorCode] || 403,
      });
    }

    const skillId = tokenResult[0].skill_id;
    const externalSkillId = tokenResult[0].external_skill_id;
    const skillType = tokenResult[0].skill_type || 'local';

    // 获取技能内容
    let skill: {
      slug: string;
      name: string;
      description: string | null;
      content: string | null;
      has_files: boolean;
      storage_path: string | null;
    } | null = null;

    if (skillType === 'local' && skillId) {
      // 本地 skill
      const { data: localSkill } = await supabase
        .from('skills')
        .select('slug, name, description, content, has_files, storage_path')
        .eq('id', skillId)
        .single();
      skill = localSkill;
    } else if (skillType === 'external' && externalSkillId) {
      // 外部 skill - 从 GitHub 拉取内容
      const { data: externalSkill } = await supabase
        .from('external_skills')
        .select('slug, name, description, raw_url, repo')
        .eq('id', externalSkillId)
        .single();

      if (externalSkill) {
        let content = '';
        if (externalSkill.raw_url) {
          try {
            const response = await fetch(externalSkill.raw_url, {
              headers: { 'User-Agent': 'SkillBank/1.0' },
            });
            if (response.ok) {
              content = await response.text();
            }
          } catch (e) {
            console.error('Failed to fetch external skill:', e);
          }
        }
        skill = {
          slug: externalSkill.slug,
          name: externalSkill.name,
          description: externalSkill.description,
          content: content || `# ${externalSkill.name}\n\nSource: ${externalSkill.repo}`,
          has_files: false,
          storage_path: null,
        };
      }
    }

    if (!skill) {
      return new NextResponse('Skill not found', { status: 404 });
    }

    // 获取或生成 Git pack
    const effectiveId = skillId || externalSkillId;
    const cacheKey = `${effectiveId}:${skill.content?.length || 0}`;
    let pack = getCachedPack(cacheKey);

    if (!pack) {
      // Generate SKILL.md content with frontmatter for skills CLI compatibility
      const content = skill.content || '# Empty Skill';
      const skillContent = content.startsWith('---')
        ? content
        : `---\nname: ${skill.name || skill.slug}\ndescription: ${skill.description || 'A SkillBank skill'}\n---\n\n${content}`;

      pack = await createGitPack(skill.slug, skillContent);
      setCachedPack(cacheKey, pack);
    }

    // 根据路径返回不同内容
    // /info/refs - 支持 Smart HTTP 和 Dumb HTTP
    if (gitPath === 'info/refs') {
      const service = request.nextUrl.searchParams.get('service');

      // Smart HTTP: git-upload-pack service
      if (service === 'git-upload-pack') {
        const smartRefs = generateSmartInfoRefs(pack);
        const encoder = new TextEncoder();

        // Smart HTTP response format: service announcement + refs
        const serviceHeader = `# service=git-upload-pack\n`;
        const headerLength = serviceHeader.length + 4;
        const headerLengthHex = headerLength.toString(16).padStart(4, '0');

        const responseBody = new Uint8Array([
          ...encoder.encode(headerLengthHex),
          ...encoder.encode(serviceHeader),
          ...encoder.encode('0000'), // flush
          ...smartRefs,
        ]);

        return new NextResponse(responseBody, {
          headers: {
            'Content-Type': 'application/x-git-upload-pack-advertisement',
            'Cache-Control': 'no-cache',
          },
        });
      }

      // Dumb HTTP: plain text refs
      const refs = generateInfoRefs(pack);
      return new NextResponse(refs, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // /HEAD
    if (gitPath === 'HEAD') {
      return new NextResponse(generateHead(), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // /objects/xx/xxxxx...
    if (gitPath.startsWith('objects/')) {
      const objectSha = parseObjectPath(gitPath);

      if (!objectSha) {
        return new NextResponse('Invalid object path', { status: 400 });
      }

      const objectData = getObject(pack, objectSha);

      if (!objectData) {
        return new NextResponse('Object not found', { status: 404 });
      }

      return new NextResponse(objectData, {
        headers: {
          'Content-Type': 'application/x-git-loose-object',
          'Cache-Control': 'max-age=31536000, immutable',
        },
      });
    }

    // /archive.tar.gz - 重定向到 tarball 端点
    if (gitPath === 'archive.tar.gz' || gitPath === 'archive') {
      return NextResponse.redirect(
        new URL(`/g/${shortCode}/archive.tar.gz`, request.url)
      );
    }

    // /git-upload-pack - Smart HTTP pack negotiation (handled by POST)
    if (gitPath === 'git-upload-pack') {
      return new NextResponse('Use POST method', { status: 405 });
    }

    return new NextResponse('Not found', { status: 404 });
  } catch (error) {
    console.error('Git HTTP error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}

/**
 * POST /g/{code}.git/git-upload-pack
 * Git Smart HTTP Protocol - pack negotiation
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { code, path: pathParts } = await params;

    // 清理短码
    const shortCode = code.replace(/\.git$/, '');
    const gitPath = pathParts.join('/');

    // 只处理 git-upload-pack 请求
    if (gitPath !== 'git-upload-pack') {
      return new NextResponse('Not found', { status: 404 });
    }

    if (!isValidShortCode(shortCode)) {
      return new NextResponse('Invalid link', { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new NextResponse('Server error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 速率限制检查
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const { data: rateLimit } = await supabase.rpc('check_rate_limit', {
      p_ip_address: clientIp,
      p_endpoint: 'git_clone',
      p_max_requests: 30,
      p_window_seconds: 60,
    });

    if (rateLimit && !rateLimit[0]?.allowed) {
      return new NextResponse('Rate limit exceeded', {
        status: 429,
        headers: { 'Retry-After': '60' },
      });
    }

    // 验证令牌（不消耗使用次数，因为 info/refs 已经消耗过了）
    const { data: tokenResult } = await supabase.rpc('verify_download_token', {
      p_short_code: shortCode,
    });

    if (!tokenResult?.[0]?.is_valid) {
      const errorCode = tokenResult?.[0]?.error_code || 'invalid';
      const statusMap: Record<string, number> = {
        not_found: 404,
        expired: 410,
        exhausted: 410,
      };
      return new NextResponse(`Token ${errorCode}`, {
        status: statusMap[errorCode] || 403,
      });
    }

    const skillId = tokenResult[0].skill_id;
    const externalSkillId = tokenResult[0].external_skill_id;
    const skillType = tokenResult[0].skill_type || 'local';

    // 获取技能内容
    let skill: {
      slug: string;
      name: string;
      description: string | null;
      content: string | null;
      has_files: boolean;
      storage_path: string | null;
    } | null = null;

    if (skillType === 'local' && skillId) {
      // 本地 skill
      const { data: localSkill } = await supabase
        .from('skills')
        .select('slug, name, description, content, has_files, storage_path')
        .eq('id', skillId)
        .single();
      skill = localSkill;
    } else if (skillType === 'external' && externalSkillId) {
      // 外部 skill - 从 GitHub 拉取内容
      const { data: externalSkill } = await supabase
        .from('external_skills')
        .select('slug, name, description, raw_url, repo')
        .eq('id', externalSkillId)
        .single();

      if (externalSkill) {
        let content = '';
        if (externalSkill.raw_url) {
          try {
            const response = await fetch(externalSkill.raw_url, {
              headers: { 'User-Agent': 'SkillBank/1.0' },
            });
            if (response.ok) {
              content = await response.text();
            }
          } catch (e) {
            console.error('Failed to fetch external skill:', e);
          }
        }
        skill = {
          slug: externalSkill.slug,
          name: externalSkill.name,
          description: externalSkill.description,
          content: content || `# ${externalSkill.name}\n\nSource: ${externalSkill.repo}`,
          has_files: false,
          storage_path: null,
        };
      }
    }

    if (!skill) {
      return new NextResponse('Skill not found', { status: 404 });
    }

    // 获取或生成 Git pack
    const effectiveId = skillId || externalSkillId;
    const cacheKey = `${effectiveId}:${skill.content?.length || 0}`;
    let pack = getCachedPack(cacheKey);

    if (!pack) {
      // Generate SKILL.md content with frontmatter for skills CLI compatibility
      const content = skill.content || '# Empty Skill';
      const skillContent = content.startsWith('---')
        ? content
        : `---\nname: ${skill.name || skill.slug}\ndescription: ${skill.description || 'A SkillBank skill'}\n---\n\n${content}`;

      pack = await createGitPack(skill.slug, skillContent);
      setCachedPack(cacheKey, pack);
    }

    // 解析请求体来检测是否是 shallow clone
    const body = await request.arrayBuffer();
    const bodyBytes = new Uint8Array(body);
    const parsed = parseUploadPackRequest(bodyBytes);

    // In stateless-rpc mode:
    // - Round 1: client sends "want <sha> ... deepen N" -> we detect isShallow
    // - Round 2: client sends only "done" -> we need to assume shallow since we only have 1 commit
    //
    // Since our repo only has 1 commit, any shallow clone is effectively the full repo.
    // We always send shallow info to support shallow clones.
    // This works because Git will accept shallow boundaries at any commit.
    const hasDepth = parsed.depth !== null && parsed.depth > 0;
    const isDoneOnly = parsed.done && parsed.wants.length === 0;
    const isShallow = hasDepth || isDoneOnly;

    // Debug: log raw body for diagnosis
    const bodyText = new TextDecoder().decode(bodyBytes);
    console.log('Upload-pack raw body:', JSON.stringify(bodyText));
    console.log('Upload-pack request:', {
      bodySize: bodyBytes.length,
      wants: parsed.wants,
      depth: parsed.depth,
      done: parsed.done,
      isShallow,
    });

    // In stateless-rpc mode:
    // Round 1 (no done): Client sends want + deepen -> Server sends shallow list + flush ONLY
    // Round 2 (with done): Client sends done -> Server sends shallow + flush + NAK + packfile
    if (!parsed.done && isShallow) {
      // Round 1: Only send shallow list, no packfile
      const encoder = new TextEncoder();
      const shallowLine = `shallow ${pack.headCommit}\n`;
      const shallowLen = (4 + shallowLine.length).toString(16).padStart(4, '0');
      const response = encoder.encode(shallowLen + shallowLine + '0000');

      console.log('Sending shallow-only response (round 1)');

      return new NextResponse(response, {
        headers: {
          'Content-Type': 'application/x-git-upload-pack-result',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Round 2 or non-shallow: Generate full response with packfile
    const packResponse = await generateUploadPackResponse(pack, isShallow, parsed.done);

    return new NextResponse(packResponse, {
      headers: {
        'Content-Type': 'application/x-git-upload-pack-result',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Git upload-pack error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
