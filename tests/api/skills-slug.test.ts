import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/skills/[slug]/route';

// Mock auth middleware
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}));

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

import { verifyToken } from '@/lib/auth-middleware';

describe('GET /api/skills/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    // Default auth mock - not authenticated
    vi.mocked(verifyToken).mockResolvedValue({
      user: null,
      error: null,
    });
  });

  it('should return public skill details', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: '1',
        name: 'test-skill',
        slug: 'test-skill',
        description: 'Test description',
        author: 'Test Author',
        category: 'development',
        tags: ['test'],
        version: '1.0.0',
        has_files: true,
        is_private: false,
        skill_stats: { installs: 100, views: 500 },
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      },
    });

    const request = new NextRequest('http://localhost/api/skills/test-skill');
    const response = await GET(request, { params: Promise.resolve({ slug: 'test-skill' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('test-skill');
    expect(data.source).toBe('local');
    expect(data.installs).toBe(100);
  });

  it('should return 404 for private skill when not authenticated', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: '1',
        name: 'private-skill',
        slug: 'private-skill',
        is_private: true,
        user_id: 'owner-123',
      },
    });

    const request = new NextRequest('http://localhost/api/skills/private-skill');
    const response = await GET(request, { params: Promise.resolve({ slug: 'private-skill' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Skill not found');
  });

  it('should return private skill to owner', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'owner-123', email: 'owner@test.com', name: 'Owner' },
      error: null,
    });

    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: '1',
        name: 'private-skill',
        slug: 'private-skill',
        description: 'Private',
        author: 'Owner',
        is_private: true,
        user_id: 'owner-123',
        has_files: true,
        version: '1.0.0',
        skill_stats: { installs: 10 },
      },
    });

    const request = new NextRequest('http://localhost/api/skills/private-skill', {
      headers: { Authorization: 'Bearer sb_test_token' },
    });
    const response = await GET(request, { params: Promise.resolve({ slug: 'private-skill' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('private-skill');
    expect(data.is_private).toBe(true);
  });

  it('should return 404 for private skill to non-owner without access', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'other-user', email: 'other@test.com', name: 'Other' },
      error: null,
    });

    // First call - get skill
    mockSupabaseClient.single
      .mockResolvedValueOnce({
        data: {
          id: '1',
          name: 'private-skill',
          slug: 'private-skill',
          is_private: true,
          user_id: 'owner-123',
        },
      })
      // Second call - check access
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

    const request = new NextRequest('http://localhost/api/skills/private-skill', {
      headers: { Authorization: 'Bearer sb_test_token' },
    });
    const response = await GET(request, { params: Promise.resolve({ slug: 'private-skill' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Skill not found');
  });

  it('should return private skill to user with access', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'authorized-user', email: 'auth@test.com', name: 'Auth' },
      error: null,
    });

    // First call - get skill
    mockSupabaseClient.single
      .mockResolvedValueOnce({
        data: {
          id: '1',
          name: 'private-skill',
          slug: 'private-skill',
          description: 'Private but accessible',
          author: 'Owner',
          is_private: true,
          user_id: 'owner-123',
          has_files: false,
          version: '1.0.0',
          skill_stats: { installs: 5 },
        },
      })
      // Second call - check access
      .mockResolvedValueOnce({
        data: { id: 'access-1' },
        error: null,
      });

    const request = new NextRequest('http://localhost/api/skills/private-skill', {
      headers: { Authorization: 'Bearer sb_test_token' },
    });
    const response = await GET(request, { params: Promise.resolve({ slug: 'private-skill' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('private-skill');
  });

  it('should return 404 when not found anywhere', async () => {
    // Mock: local skills not found
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });
    // Mock: external_skills not found
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });
    // Mock: external_skills by name not found
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new NextRequest('http://localhost/api/skills/nonexistent');
    const response = await GET(request, { params: Promise.resolve({ slug: 'nonexistent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Skill not found');
  });

  it('should return external skill from external_skills table', async () => {
    // Mock: local skills not found
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });
    // Mock: external_skills found
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'external-1',
        name: 'github-skill',
        slug: 'github-skill',
        description: 'A skill from GitHub',
        repo: 'owner/repo',
        repo_path: 'skills/my-skill',
        branch: 'main',
        raw_url: 'https://raw.githubusercontent.com/owner/repo/main/skills/my-skill/SKILL.md',
        github_owner: 'owner',
        installs: 500,
        stars: 25,
        author: {
          id: 'author-1',
          github_login: 'owner',
          name: 'Skill Owner',
          avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        },
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/skills/github-skill');
    const response = await GET(request, { params: Promise.resolve({ slug: 'github-skill' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe('github');
    expect(data.contentSource).toBe('github');
    expect(data.repo).toBe('owner/repo');
    expect(data.installs).toBe(500);
    expect(data.stars).toBe(25);
  });

  it('should find external skill by name if slug not found', async () => {
    // Mock: local skills not found
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });
    // Mock: external_skills by slug not found
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });
    // Mock: external_skills by name found
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'external-2',
        name: 'my-skill-name',
        slug: 'my-skill-name',
        description: 'Found by name',
        repo: 'owner/repo',
        github_owner: 'owner',
        installs: 100,
        stars: 10,
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/skills/my-skill-name');
    const response = await GET(request, { params: Promise.resolve({ slug: 'my-skill-name' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.source).toBe('github');
    expect(data.name).toBe('my-skill-name');
  });
});
