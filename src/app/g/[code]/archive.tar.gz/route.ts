import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidShortCode } from '@/lib/download-token';
import * as pako from 'pako';

type Props = {
  params: Promise<{ code: string }>;
};

/**
 * 创建简单的 tar 文件（不压缩）
 * tar 格式：每个文件有 512 字节的 header，然后是内容（填充到 512 字节边界）
 */
function createTarEntry(filename: string, content: string): Uint8Array {
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);
  const contentSize = contentBytes.length;

  // TAR header is 512 bytes
  const header = new Uint8Array(512);

  // File name (100 bytes)
  const nameBytes = encoder.encode(filename);
  header.set(nameBytes.slice(0, 100), 0);

  // File mode (8 bytes) - 0644
  header.set(encoder.encode('0000644\0'), 100);

  // Owner UID (8 bytes)
  header.set(encoder.encode('0000000\0'), 108);

  // Group GID (8 bytes)
  header.set(encoder.encode('0000000\0'), 116);

  // File size in octal (12 bytes)
  const sizeOctal = contentSize.toString(8).padStart(11, '0') + '\0';
  header.set(encoder.encode(sizeOctal), 124);

  // Modification time (12 bytes)
  const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0';
  header.set(encoder.encode(mtime), 136);

  // Checksum placeholder (8 bytes of spaces)
  header.set(encoder.encode('        '), 148);

  // Type flag (1 byte) - '0' for regular file
  header[156] = 48; // '0'

  // Link name (100 bytes) - empty

  // USTAR magic and version
  header.set(encoder.encode('ustar\0'), 257);
  header.set(encoder.encode('00'), 263);

  // Owner name (32 bytes)
  header.set(encoder.encode('skillshot'), 265);

  // Group name (32 bytes)
  header.set(encoder.encode('skillshot'), 297);

  // Calculate checksum
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  const checksumOctal = checksum.toString(8).padStart(6, '0') + '\0 ';
  header.set(encoder.encode(checksumOctal), 148);

  // Calculate padding to 512-byte boundary
  const paddingSize = contentSize > 0 ? (512 - (contentSize % 512)) % 512 : 0;
  const padding = new Uint8Array(paddingSize);

  // Combine header, content, and padding
  const entry = new Uint8Array(512 + contentSize + paddingSize);
  entry.set(header, 0);
  entry.set(contentBytes, 512);
  entry.set(padding, 512 + contentSize);

  return entry;
}

/**
 * 创建完整的 tar.gz 文件
 */
function createTarGz(files: Array<{ name: string; content: string }>): Uint8Array {
  const entries: Uint8Array[] = [];

  for (const file of files) {
    entries.push(createTarEntry(file.name, file.content));
  }

  // Add two 512-byte zero blocks as end marker
  entries.push(new Uint8Array(1024));

  // Combine all entries
  const totalSize = entries.reduce((acc, e) => acc + e.length, 0);
  const tarData = new Uint8Array(totalSize);
  let offset = 0;
  for (const entry of entries) {
    tarData.set(entry, offset);
    offset += entry.length;
  }

  // Gzip compress
  return pako.gzip(tarData);
}

/**
 * GET /g/{code}/archive.tar.gz
 * 下载技能为 tarball
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { code } = await params;

    // 清理短码
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

    // 速率限制
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const { data: rateLimit } = await supabase.rpc('check_rate_limit', {
      p_ip_address: clientIp,
      p_endpoint: 'tarball',
      p_max_requests: 10,
      p_window_seconds: 60,
    });

    if (rateLimit && !rateLimit[0]?.allowed) {
      return new NextResponse('Rate limit exceeded', {
        status: 429,
        headers: { 'Retry-After': '60' },
      });
    }

    // 使用令牌
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

    // 获取技能内容
    const { data: skill } = await supabase
      .from('skills')
      .select('slug, content, has_files, storage_path')
      .eq('id', skillId)
      .single();

    if (!skill) {
      return new NextResponse('Skill not found', { status: 404 });
    }

    // 如果有完整的包文件，从 Storage 返回
    if (skill.has_files && skill.storage_path) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('skill-packages')
        .download(skill.storage_path);

      if (!downloadError && fileData) {
        const buffer = await fileData.arrayBuffer();
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/gzip',
            'Content-Disposition': `attachment; filename="${skill.slug}.tar.gz"`,
            'Content-Length': buffer.byteLength.toString(),
          },
        });
      }
    }

    // 否则动态生成 tarball（只包含 SKILL.md）
    const files = [
      {
        name: `${skill.slug}/SKILL.md`,
        content: skill.content || '# Empty Skill',
      },
    ];

    const tarGz = createTarGz(files);

    return new NextResponse(Buffer.from(tarGz), {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${skill.slug}.tar.gz"`,
        'Content-Length': tarGz.length.toString(),
      },
    });
  } catch (error) {
    console.error('Tarball download error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
