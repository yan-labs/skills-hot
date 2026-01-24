import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-middleware';

/**
 * GET /api/user/skills
 * Get all skills owned by the current user (both public and private)
 */
export async function GET(request: NextRequest) {
  try {
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'server_error', error_description: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's skills
    const { data: skills, error } = await supabase
      .from('skills')
      .select('*, skill_stats(installs, views)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Fetch error:', error);
      return NextResponse.json(
        { error: 'server_error', error_description: 'Failed to fetch skills' },
        { status: 500 }
      );
    }

    // Get skills user has access to (authorized by others)
    const { data: accessRecords } = await supabase
      .from('skill_access')
      .select('skill_id, access_type, expires_at, skills(*)')
      .eq('user_id', user.id)
      .or('expires_at.is.null,expires_at.gt.now()');

    const authorizedSkills = accessRecords
      ?.filter((r) => r.skills)
      .map((r) => ({
        ...r.skills,
        access_type: r.access_type,
        access_expires_at: r.expires_at,
      })) || [];

    return NextResponse.json({
      owned: skills || [],
      authorized: authorizedSkills,
    });
  } catch (error) {
    console.error('User skills error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}
