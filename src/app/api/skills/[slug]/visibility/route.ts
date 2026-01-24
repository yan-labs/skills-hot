import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-middleware';

type Props = {
  params: Promise<{ slug: string }>;
};

/**
 * PATCH /api/skills/[slug]/visibility
 * Update skill visibility (public/private)
 * Only the skill owner can change visibility
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { slug } = await params;

    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = authResult.user;

    // Parse request body
    const body = await request.json();
    const { is_private } = body;

    if (typeof is_private !== 'boolean') {
      return NextResponse.json(
        { error: 'validation_error', error_description: 'is_private must be a boolean' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'server_error', error_description: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get skill and verify ownership
    const { data: skill, error: fetchError } = await supabase
      .from('skills')
      .select('id, user_id, name, is_private')
      .eq('slug', slug)
      .single();

    if (fetchError || !skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    if (skill.user_id !== user.id) {
      return NextResponse.json(
        { error: 'permission_denied', error_description: 'Only the skill owner can change visibility' },
        { status: 403 }
      );
    }

    // Update visibility
    const { error: updateError } = await supabase
      .from('skills')
      .update({ is_private, updated_at: new Date().toISOString() })
      .eq('id', skill.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'server_error', error_description: 'Failed to update visibility' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      skill: {
        slug,
        name: skill.name,
        is_private,
      },
    });
  } catch (error) {
    console.error('Visibility update error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
