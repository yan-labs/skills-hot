import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-middleware';

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/skills/[slug]/package
 * Download skill package (ZIP file)
 * - Only available for local skills with has_files=true
 * - Private skills require authentication and authorization
 */
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { slug } = await params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new NextResponse('Server configuration error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get skill info
    const { data: skill, error: skillError } = await supabase
      .from('skills')
      .select('id, has_files, storage_path, is_private, user_id')
      .eq('slug', slug)
      .single();

    if (skillError || !skill) {
      return new NextResponse('Skill not found', { status: 404 });
    }

    // Check if skill has package
    if (!skill.has_files || !skill.storage_path) {
      return new NextResponse('No package available for this skill', { status: 404 });
    }

    // Check access for private skills
    if (skill.is_private) {
      const authHeader = request.headers.get('Authorization');
      const authResult = await verifyToken(authHeader);
      const currentUser = authResult.user;

      if (!currentUser) {
        return new NextResponse('Authentication required', { status: 401 });
      }

      if (skill.user_id !== currentUser.id) {
        // Check skill_access table
        const { data: access } = await supabase
          .from('skill_access')
          .select('id, access_type')
          .eq('skill_id', skill.id)
          .eq('user_id', currentUser.id)
          .or('expires_at.is.null,expires_at.gt.now()')
          .single();

        if (!access || (access.access_type !== 'download' && access.access_type !== 'full')) {
          return new NextResponse('Access denied', { status: 403 });
        }
      }
    }

    // Download from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('skill-packages')
      .download(skill.storage_path);

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError);
      return new NextResponse('Failed to download package', { status: 500 });
    }

    // Return the ZIP file
    const buffer = await fileData.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${slug}.zip"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Package download error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
