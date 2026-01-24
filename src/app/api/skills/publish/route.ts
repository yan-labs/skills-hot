import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-middleware';

interface SkillMetadata {
  name: string;
  description?: string;
  version?: string;
  category?: string;
  tags?: string[];
  author?: string;
  source_url?: string;
  is_private?: boolean;
}

/**
 * Generate URL-friendly slug from skill name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * POST /api/skills/publish
 * Publish or update a skill
 *
 * Content-Type: multipart/form-data
 * Authorization: Bearer <token>
 *
 * Body:
 * - metadata: JSON string (name, description, version, category, tags, author, source_url)
 * - content: string (SKILL.md content)
 * - package: File (optional, ZIP file)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const authHeader = request.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error?.code || 'unauthorized', error_description: authResult.error?.message },
        { status: 401 }
      );
    }

    const user = authResult.user;

    // 2. Parse form data
    const formData = await request.formData();
    const metadataStr = formData.get('metadata') as string;
    const content = formData.get('content') as string;
    const packageFile = formData.get('package') as File | null;

    if (!metadataStr) {
      return NextResponse.json(
        { error: 'validation_error', error_description: 'metadata is required' },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: 'validation_error', error_description: 'content is required' },
        { status: 400 }
      );
    }

    // 3. Parse and validate metadata
    let metadata: SkillMetadata;
    try {
      metadata = JSON.parse(metadataStr);
    } catch {
      return NextResponse.json(
        { error: 'validation_error', error_description: 'Invalid metadata JSON' },
        { status: 400 }
      );
    }

    if (!metadata.name) {
      return NextResponse.json(
        { error: 'validation_error', error_description: 'name is required in metadata' },
        { status: 400 }
      );
    }

    // 4. Generate slug
    const slug = generateSlug(metadata.name);

    if (!slug) {
      return NextResponse.json(
        { error: 'validation_error', error_description: 'Invalid skill name' },
        { status: 400 }
      );
    }

    // 5. Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'server_error', error_description: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 6. Check if skill already exists
    const { data: existingSkill } = await supabase
      .from('skills')
      .select('id, user_id, slug')
      .eq('slug', slug)
      .single();

    // 7. Permission check for existing skills
    if (existingSkill) {
      if (existingSkill.user_id && existingSkill.user_id !== user.id) {
        return NextResponse.json(
          { error: 'permission_denied', error_description: 'You do not have permission to update this skill' },
          { status: 403 }
        );
      }
    }

    // 8. Upload package to Storage if provided
    let storagePath: string | null = null;
    let hasFiles = false;

    if (packageFile) {
      // Validate file size (50MB limit)
      if (packageFile.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'file_too_large', error_description: 'Package file must be less than 50MB' },
          { status: 400 }
        );
      }

      // Validate file type
      if (!packageFile.type.includes('zip')) {
        return NextResponse.json(
          { error: 'validation_error', error_description: 'Package must be a ZIP file' },
          { status: 400 }
        );
      }

      const version = metadata.version || '1.0.0';
      storagePath = `${user.id}/${slug}/${version}.zip`;

      const fileBuffer = await packageFile.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('skill-packages')
        .upload(storagePath, fileBuffer, {
          contentType: 'application/zip',
          upsert: true,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return NextResponse.json(
          { error: 'server_error', error_description: 'Failed to upload package' },
          { status: 500 }
        );
      }

      hasFiles = true;
    }

    // 9. Prepare skill data
    const skillData = {
      name: metadata.name,
      slug,
      description: metadata.description || '',
      content,
      author: metadata.author || user.name || user.email,
      source_url: metadata.source_url || null,
      category: metadata.category || null,
      tags: metadata.tags || [],
      user_id: user.id,
      version: metadata.version || '1.0.0',
      storage_path: storagePath,
      has_files: hasFiles,
      is_private: metadata.is_private || false,
      updated_at: new Date().toISOString(),
    };

    // 10. Insert or update skill
    let result;
    if (existingSkill) {
      // Update existing skill
      const { data, error } = await supabase
        .from('skills')
        .update(skillData)
        .eq('id', existingSkill.id)
        .select()
        .single();

      if (error) {
        console.error('Update error:', error);
        return NextResponse.json(
          { error: 'server_error', error_description: 'Failed to update skill' },
          { status: 500 }
        );
      }
      result = { ...data, action: 'updated' };
    } else {
      // Insert new skill
      const { data, error } = await supabase
        .from('skills')
        .insert({
          ...skillData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Insert error:', error);
        return NextResponse.json(
          { error: 'server_error', error_description: 'Failed to create skill' },
          { status: 500 }
        );
      }
      result = { ...data, action: 'created' };
    }

    // 11. Return success response
    return NextResponse.json({
      success: true,
      action: result.action,
      skill: {
        id: result.id,
        name: result.name,
        slug: result.slug,
        version: result.version,
        has_files: result.has_files,
        is_private: result.is_private,
      },
    });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
