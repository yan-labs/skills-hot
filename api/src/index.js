// SkillBank API - Cloudflare Workers

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route handling
      if (path === '/api/skills' && request.method === 'GET') {
        return await handleGetSkills(url, env);
      }

      if (path.startsWith('/api/skills/') && path.endsWith('/raw') && request.method === 'GET') {
        const slug = path.replace('/api/skills/', '').replace('/raw', '');
        return await handleGetSkillRaw(slug, env);
      }

      if (path.startsWith('/api/skills/') && request.method === 'GET') {
        const slug = path.replace('/api/skills/', '');
        return await handleGetSkill(slug, env);
      }

      if (path === '/api/stats' && request.method === 'POST') {
        return await handlePostStats(request, env);
      }

      // Health check
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('API Error:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};

// Get skills list with optional search
async function handleGetSkills(url, env) {
  const query = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let supabaseQuery = `${env.SUPABASE_URL}/rest/v1/skills?select=id,name,slug,description,author,category,tags,is_paid,price,skill_stats(installs,views,copies,favorites)`;

  const filters = [];

  if (query) {
    filters.push(`or=(name.ilike.*${encodeURIComponent(query)}*,description.ilike.*${encodeURIComponent(query)}*)`);
  }

  if (category) {
    filters.push(`category=eq.${encodeURIComponent(category)}`);
  }

  if (filters.length > 0) {
    supabaseQuery += '&' + filters.join('&');
  }

  supabaseQuery += `&limit=${limit}&offset=${offset}&order=created_at.desc`;

  const response = await fetch(supabaseQuery, {
    headers: {
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  const data = await response.json();

  // Flatten skill_stats
  const skills = data.map((skill) => ({
    ...skill,
    installs: skill.skill_stats?.[0]?.installs || 0,
    views: skill.skill_stats?.[0]?.views || 0,
    copies: skill.skill_stats?.[0]?.copies || 0,
    favorites: skill.skill_stats?.[0]?.favorites || 0,
    skill_stats: undefined,
  }));

  return jsonResponse(skills);
}

// Get single skill by slug
async function handleGetSkill(slug, env) {
  const supabaseQuery = `${env.SUPABASE_URL}/rest/v1/skills?slug=eq.${encodeURIComponent(slug)}&select=*,skill_stats(installs,views,copies,favorites)`;

  const response = await fetch(supabaseQuery, {
    headers: {
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  const data = await response.json();

  if (data.length === 0) {
    return jsonResponse({ error: 'Skill not found' }, 404);
  }

  const skill = data[0];
  return jsonResponse({
    ...skill,
    installs: skill.skill_stats?.[0]?.installs || 0,
    views: skill.skill_stats?.[0]?.views || 0,
    copies: skill.skill_stats?.[0]?.copies || 0,
    favorites: skill.skill_stats?.[0]?.favorites || 0,
    skill_stats: undefined,
  });
}

// Get raw SKILL.md content
async function handleGetSkillRaw(slug, env) {
  const supabaseQuery = `${env.SUPABASE_URL}/rest/v1/skills?slug=eq.${encodeURIComponent(slug)}&select=content`;

  const response = await fetch(supabaseQuery, {
    headers: {
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  const data = await response.json();

  if (data.length === 0) {
    return new Response('Skill not found', { status: 404, headers: corsHeaders });
  }

  return new Response(data[0].content || '', {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/markdown',
    },
  });
}

// Post statistics event
async function handlePostStats(request, env) {
  const body = await request.json();
  const { skill_id, event_type } = body;

  if (!skill_id || !event_type) {
    return jsonResponse({ error: 'Missing skill_id or event_type' }, 400);
  }

  const validEvents = ['install', 'view', 'copy', 'favorite'];
  if (!validEvents.includes(event_type)) {
    return jsonResponse({ error: 'Invalid event_type' }, 400);
  }

  // Insert stat event
  const insertResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/stat_events`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ skill_id, event_type }),
  });

  if (!insertResponse.ok) {
    // Silently fail - don't block user operations
    console.error('Failed to insert stat event');
  }

  // Update aggregate stats
  const columnMap = {
    install: 'installs',
    view: 'views',
    copy: 'copies',
    favorite: 'favorites',
  };
  const column = columnMap[event_type];

  // Use RPC to increment counter
  await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/increment_stat`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_skill_id: skill_id, p_column: column }),
  }).catch(() => {
    // Ignore errors
  });

  return jsonResponse({ success: true });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
