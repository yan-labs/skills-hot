import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/skills/route';

// Mock auth middleware
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}));

// Mock Supabase
const mockIn = vi.fn();
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn(),
  in: mockIn,
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock fetch for SkillSMP
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { verifyToken } from '@/lib/auth-middleware';

describe('GET /api/skills', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.SKILLSMP_API_KEY = 'test-api-key';

    // Default auth mock - not authenticated
    vi.mocked(verifyToken).mockResolvedValue({
      user: null,
      error: null,
    });

    // Default mock for skills_sh_cache query - returns empty
    mockIn.mockResolvedValue({ data: [], error: null });
  });

  it('should return public skills when not authenticated', async () => {
    mockSupabaseClient.limit.mockResolvedValueOnce({
      data: [
        {
          id: '1',
          name: 'public-skill',
          slug: 'public-skill',
          description: 'A public skill',
          author: 'test',
          is_private: false,
          has_files: false,
          version: '1.0.0',
          skill_stats: [{ installs: 100 }],
        },
      ],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { skills: [] },
        }),
    });

    const request = new NextRequest('http://localhost/api/skills');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].name).toBe('public-skill');
    expect(data[0].source).toBe('local');
  });

  it('should filter by search query', async () => {
    mockSupabaseClient.limit.mockResolvedValueOnce({
      data: [
        {
          id: '1',
          name: 'git-commit',
          slug: 'git-commit',
          description: 'Git commit best practices',
          author: 'test',
          is_private: false,
          has_files: false,
          version: '1.0.0',
          skill_stats: [],
        },
      ],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { skills: [] } }),
    });

    const request = new NextRequest('http://localhost/api/skills?q=git');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockSupabaseClient.or).toHaveBeenCalled();
  });

  it('should require authentication for source=my', async () => {
    const request = new NextRequest('http://localhost/api/skills?source=my');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Authentication required');
  });

  it('should return user skills when authenticated with source=my', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
      error: null,
    });

    mockSupabaseClient.limit.mockResolvedValueOnce({
      data: [
        {
          id: '1',
          name: 'my-skill',
          slug: 'my-skill',
          description: 'My private skill',
          author: 'Test',
          is_private: true,
          has_files: true,
          version: '1.0.0',
          skill_stats: [{ installs: 10 }],
        },
      ],
    });

    const request = new NextRequest('http://localhost/api/skills?source=my', {
      headers: { Authorization: 'Bearer sb_test_token' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data[0].name).toBe('my-skill');
    expect(data[0].is_private).toBe(true);
  });

  it('should include SkillSMP results when source=all', async () => {
    mockSupabaseClient.limit.mockResolvedValueOnce({
      data: [],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            skills: [
              {
                id: 'skillsmp-1',
                name: 'external-skill',
                author: 'external',
                description: 'From SkillSMP',
                githubUrl: 'https://github.com/test',
                skillUrl: 'https://skillsmp.com/skill/1',
              },
            ],
          },
        }),
    });

    const request = new NextRequest('http://localhost/api/skills');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.find((s: { source: string }) => s.source === 'skillsmp')).toBeDefined();
  });

  it('should exclude SkillSMP when source=local', async () => {
    mockSupabaseClient.limit.mockResolvedValueOnce({
      data: [],
    });

    const request = new NextRequest('http://localhost/api/skills?source=local');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle limit parameter', async () => {
    mockSupabaseClient.limit.mockResolvedValueOnce({
      data: [],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { skills: [] } }),
    });

    const request = new NextRequest('http://localhost/api/skills?limit=10');
    await GET(request);

    expect(mockSupabaseClient.limit).toHaveBeenCalledWith(10);
  });

  it('should show private skills to their owner', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
      error: null,
    });

    mockSupabaseClient.limit.mockResolvedValueOnce({
      data: [
        {
          id: '1',
          name: 'private-skill',
          slug: 'private-skill',
          description: 'Private',
          author: 'Test',
          is_private: true,
          user_id: 'user-123',
          has_files: false,
          version: '1.0.0',
          skill_stats: [],
        },
      ],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { skills: [] } }),
    });

    const request = new NextRequest('http://localhost/api/skills', {
      headers: { Authorization: 'Bearer sb_test_token' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // The or() clause should include user's private skills
    expect(mockSupabaseClient.or).toHaveBeenCalled();
  });

  it('should handle SkillSMP API errors gracefully', async () => {
    mockSupabaseClient.limit.mockResolvedValueOnce({
      data: [
        {
          id: '1',
          name: 'local-skill',
          slug: 'local-skill',
          description: 'Local',
          author: 'Test',
          is_private: false,
          has_files: false,
          version: '1.0.0',
          skill_stats: [],
        },
      ],
    });

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const request = new NextRequest('http://localhost/api/skills');
    const response = await GET(request);
    const data = await response.json();

    // Should still return local results
    expect(response.status).toBe(200);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].source).toBe('local');
  });
});
