import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/skills/[slug]/share/route';

// Mock auth middleware
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}));

// Mock download-token
vi.mock('@/lib/download-token', async () => {
  const actual = await vi.importActual('@/lib/download-token');
  return {
    ...actual,
    prepareTokenData: vi.fn().mockResolvedValue({
      shortCode: 'x7Kp2Q',
      fullToken: 'dt_x7Kp2Q_1234567890abcdef',
      tokenHash: 'abc123hash',
      expiresAt: new Date(Date.now() + 600000),
      maxUses: 5,
    }),
    buildShortUrl: vi.fn().mockReturnValue({
      shortUrl: 'https://skillbank.dev/g/x7Kp2Q',
      gitUrl: 'https://skillbank.dev/g/x7Kp2Q.git',
      tarballUrl: 'https://skillbank.dev/g/x7Kp2Q/archive.tar.gz',
    }),
  };
});

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

import { verifyToken } from '@/lib/auth-middleware';

describe('POST /api/skills/[slug]/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://skillbank.dev';

    // Reset mock chain
    mockSupabaseClient.from.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
    mockSupabaseClient.insert.mockReturnThis();
    mockSupabaseClient.eq.mockReturnThis();
    mockSupabaseClient.or.mockReturnThis();
    mockSupabaseClient.gt.mockReturnThis();
    mockSupabaseClient.order.mockReturnThis();
  });

  describe('Public skills', () => {
    it('should allow anonymous user to generate share link for public skill', async () => {
      // No auth
      vi.mocked(verifyToken).mockResolvedValue({
        user: null,
        error: null,
      });

      // Skill is public
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'skill-1',
          slug: 'public-skill',
          name: 'Public Skill',
          is_private: false,
          user_id: 'owner-123',
          has_files: false,
        },
      });

      // Insert succeeds
      mockSupabaseClient.insert.mockResolvedValueOnce({ error: null });

      const request = new NextRequest('http://localhost/api/skills/public-skill/share', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'git_clone' }),
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'public-skill' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.short_url).toBe('https://skillbank.dev/g/x7Kp2Q');
      expect(data.git_url).toBe('https://skillbank.dev/g/x7Kp2Q.git');
      expect(data.clone_command).toContain('git clone');
      expect(data.npx_command).toContain('npx skills add');
    });

    it('should allow authenticated user to generate share link for public skill', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        user: { id: 'user-123', email: 'user@test.com', name: 'User' },
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'skill-1',
          slug: 'public-skill',
          name: 'Public Skill',
          is_private: false,
          user_id: 'owner-123',
          has_files: false,
        },
      });

      mockSupabaseClient.insert.mockResolvedValueOnce({ error: null });

      const request = new NextRequest('http://localhost/api/skills/public-skill/share', {
        method: 'POST',
        headers: { Authorization: 'Bearer sb_test_token' },
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'public-skill' }) });

      expect(response.status).toBe(200);
    });
  });

  describe('Private skills', () => {
    it('should require authentication for private skill', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        user: null,
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'skill-1',
          slug: 'private-skill',
          name: 'Private Skill',
          is_private: true,
          user_id: 'owner-123',
        },
      });

      const request = new NextRequest('http://localhost/api/skills/private-skill/share', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'private-skill' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('unauthorized');
    });

    it('should allow owner to generate share link for private skill', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        user: { id: 'owner-123', email: 'owner@test.com', name: 'Owner' },
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'skill-1',
          slug: 'private-skill',
          name: 'Private Skill',
          is_private: true,
          user_id: 'owner-123',
          has_files: false,
        },
      });

      mockSupabaseClient.insert.mockResolvedValueOnce({ error: null });

      const request = new NextRequest('http://localhost/api/skills/private-skill/share', {
        method: 'POST',
        headers: { Authorization: 'Bearer sb_test_token' },
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'private-skill' }) });

      expect(response.status).toBe(200);
    });

    it('should allow user with download access to generate share link', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        user: { id: 'authorized-user', email: 'auth@test.com', name: 'Auth' },
        error: null,
      });

      // First call - get skill
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: 'skill-1',
            slug: 'private-skill',
            name: 'Private Skill',
            is_private: true,
            user_id: 'owner-123',
            has_files: false,
          },
        })
        // Second call - check access
        .mockResolvedValueOnce({
          data: { access_type: 'download' },
          error: null,
        });

      mockSupabaseClient.insert.mockResolvedValueOnce({ error: null });

      const request = new NextRequest('http://localhost/api/skills/private-skill/share', {
        method: 'POST',
        headers: { Authorization: 'Bearer sb_test_token' },
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'private-skill' }) });

      expect(response.status).toBe(200);
    });

    it('should deny user with only view access', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        user: { id: 'view-only-user', email: 'view@test.com', name: 'View' },
        error: null,
      });

      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: 'skill-1',
            slug: 'private-skill',
            name: 'Private Skill',
            is_private: true,
            user_id: 'owner-123',
          },
        })
        .mockResolvedValueOnce({
          data: { access_type: 'view' },
          error: null,
        });

      const request = new NextRequest('http://localhost/api/skills/private-skill/share', {
        method: 'POST',
        headers: { Authorization: 'Bearer sb_test_token' },
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'private-skill' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('forbidden');
    });

    it('should deny user without any access', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        user: { id: 'no-access-user', email: 'no@test.com', name: 'No' },
        error: null,
      });

      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: 'skill-1',
            slug: 'private-skill',
            name: 'Private Skill',
            is_private: true,
            user_id: 'owner-123',
          },
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Not found' },
        });

      const request = new NextRequest('http://localhost/api/skills/private-skill/share', {
        method: 'POST',
        headers: { Authorization: 'Bearer sb_test_token' },
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'private-skill' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('forbidden');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent skill', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        user: null,
        error: null,
      });

      // Mock all three queries: skills, external_skills by slug, external_skills by name
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } }) // skills table
        .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } }) // external_skills by slug
        .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } }); // external_skills by name

      const request = new NextRequest('http://localhost/api/skills/nonexistent/share', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('not_found');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        user: null,
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'skill-1',
          slug: 'public-skill',
          name: 'Public Skill',
          is_private: false,
        },
      });

      mockSupabaseClient.insert.mockResolvedValueOnce({
        error: { message: 'Database error' },
      });

      const request = new NextRequest('http://localhost/api/skills/public-skill/share', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'public-skill' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('server_error');
    });
  });

  describe('Request body parsing', () => {
    it('should accept empty body', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        user: null,
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'skill-1',
          slug: 'public-skill',
          name: 'Public Skill',
          is_private: false,
        },
      });

      mockSupabaseClient.insert.mockResolvedValueOnce({ error: null });

      const request = new NextRequest('http://localhost/api/skills/public-skill/share', {
        method: 'POST',
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'public-skill' }) });

      expect(response.status).toBe(200);
    });

    it('should accept custom expires_in and max_uses', async () => {
      vi.mocked(verifyToken).mockResolvedValue({
        user: null,
        error: null,
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'skill-1',
          slug: 'public-skill',
          name: 'Public Skill',
          is_private: false,
        },
      });

      mockSupabaseClient.insert.mockResolvedValueOnce({ error: null });

      const request = new NextRequest('http://localhost/api/skills/public-skill/share', {
        method: 'POST',
        body: JSON.stringify({
          expires_in: 1800,
          max_uses: 10,
          purpose: 'tarball',
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ slug: 'public-skill' }) });

      expect(response.status).toBe(200);
    });
  });
});

describe('GET /api/skills/[slug]/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    mockSupabaseClient.from.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
    mockSupabaseClient.eq.mockReturnThis();
    mockSupabaseClient.gt.mockReturnThis();
    mockSupabaseClient.order.mockReturnThis();
  });

  it('should require authentication', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: null,
      error: { code: 'unauthorized', message: 'Not authenticated' },
    });

    const request = new NextRequest('http://localhost/api/skills/test-skill/share');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-skill' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('unauthorized');
  });

  it('should return active tokens for authenticated user', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'user@test.com', name: 'User' },
      error: null,
    });

    // First call - get skill
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { id: 'skill-1' },
    });

    // Second call - get tokens (returns array, not single)
    mockSupabaseClient.order.mockResolvedValueOnce({
      data: [
        {
          short_code: 'abc123',
          expires_at: new Date(Date.now() + 300000).toISOString(),
          max_uses: 5,
          use_count: 2,
          purpose: 'git_clone',
          created_at: new Date().toISOString(),
        },
      ],
    });

    const request = new NextRequest('http://localhost/api/skills/test-skill/share', {
      headers: { Authorization: 'Bearer sb_test_token' },
    });

    const response = await GET(request, { params: Promise.resolve({ slug: 'test-skill' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tokens).toHaveLength(1);
    expect(data.tokens[0].remaining_uses).toBe(3);
  });
});
