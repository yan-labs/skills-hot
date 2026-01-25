import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-middleware';
import { fetchGitHubContent, fetchGitHubDirectory, getGitHubRawUrl, parseTopSource } from '@/lib/github-content';

/**
 * POST /api/skills/import
 * Import an external skill from GitHub to the platform
 * Requires authentication and the user must be the skill owner
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    const authResult = await verifyToken(authHeader);

    if (!authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { externalSkillId } = await request.json();

    if (!externalSkillId) {
      return NextResponse.json({ error: 'externalSkillId is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get the external skill with author info
    const { data: externalSkill, error: externalError } = await supabase
      .from('external_skills')
      .select('*, author:authors(*)')
      .eq('id', externalSkillId)
      .single();

    if (externalError || !externalSkill) {
      return NextResponse.json({ error: 'External skill not found' }, { status: 404 });
    }

    // 2. Verify ownership - user must be the author
    if (!externalSkill.author || externalSkill.author.user_id !== authResult.user.id) {
      return NextResponse.json(
        { error: 'You can only import your own skills' },
        { status: 403 }
      );
    }

    // 3. Check if already imported
    const { data: existingImport } = await supabase
      .from('skills')
      .select('id')
      .eq('imported_from', externalSkillId)
      .single();

    if (existingImport) {
      return NextResponse.json(
        { error: 'This skill has already been imported', skillId: existingImport.id },
        { status: 409 }
      );
    }

    // 4. Fetch content from GitHub
    let content = '';
    if (externalSkill.raw_url) {
      content = await fetchGitHubContent(externalSkill.raw_url);
    } else if (externalSkill.repo) {
      const { owner, repo } = parseTopSource(externalSkill.repo);
      const rawUrl = getGitHubRawUrl(owner, repo, externalSkill.branch || 'main', externalSkill.repo_path);
      content = await fetchGitHubContent(rawUrl);
    }

    if (!content || content.includes('Content Unavailable')) {
      return NextResponse.json(
        { error: 'Could not fetch skill content from GitHub' },
        { status: 502 }
      );
    }

    // 5. Check if slug is available
    const { data: existingSlug } = await supabase
      .from('skills')
      .select('id')
      .eq('slug', externalSkill.slug)
      .single();

    const slug = existingSlug
      ? `${externalSkill.slug}-${authResult.user.id.slice(0, 8)}`
      : externalSkill.slug;

    // 6. Fetch additional files from GitHub (optional)
    let hasFiles = false;
    if (externalSkill.repo) {
      const { owner, repo } = parseTopSource(externalSkill.repo);
      const files = await fetchGitHubDirectory(
        owner,
        repo,
        externalSkill.repo_path,
        externalSkill.branch || 'main'
      );
      // Filter out SKILL.md and hidden files
      const additionalFiles = files.filter(
        f => f.name !== 'SKILL.md' && !f.name.startsWith('.')
      );
      hasFiles = additionalFiles.length > 0;

      // TODO: Download and upload files to storage if needed
      // For now, we just mark has_files
    }

    // 7. Create the local skill
    const { data: skill, error: insertError } = await supabase
      .from('skills')
      .insert({
        name: externalSkill.name,
        slug,
        description: externalSkill.description,
        content,
        author: externalSkill.github_owner,
        source_url: `https://github.com/${externalSkill.repo}`,
        user_id: authResult.user.id,
        author_id: externalSkill.author_id,
        imported_from: externalSkillId,
        version: '1.0.0',
        has_files: hasFiles,
        is_private: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create skill:', insertError);
      return NextResponse.json(
        { error: 'Failed to import skill' },
        { status: 500 }
      );
    }

    // 8. Update author stats
    if (externalSkill.author_id) {
      await supabase.rpc('update_author_stats', { p_author_id: externalSkill.author_id });
    }

    return NextResponse.json({
      success: true,
      skill: {
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        imported_from: externalSkillId,
      },
    });
  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
