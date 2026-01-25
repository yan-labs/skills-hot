import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth middleware
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}));

// Mock github-content
vi.mock('@/lib/github-content', () => ({
  fetchGitHubContent: vi.fn(),
  fetchGitHubDirectory: vi.fn(),
  getGitHubRawUrl: vi.fn(),
  parseTopSource: vi.fn(),
}));

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  single: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

import { verifyToken } from '@/lib/auth-middleware';
import { fetchGitHubContent, fetchGitHubDirectory, parseTopSource } from '@/lib/github-content';
import { POST } from '@/app/api/skills/import/route';

describe('POST /api/skills/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
    });

    const request = new NextRequest('http://localhost/api/skills/import', {
      method: 'POST',
      body: JSON.stringify({ externalSkillId: 'test-id' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 400 if externalSkillId is missing', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com', name: 'Test' },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/skills/import', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('externalSkillId is required');
  });

  it('should return 404 if external skill not found', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com', name: 'Test' },
      error: null,
    });

    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new NextRequest('http://localhost/api/skills/import', {
      method: 'POST',
      body: JSON.stringify({ externalSkillId: 'nonexistent' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('External skill not found');
  });

  it('should return 403 if user is not the skill owner', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com', name: 'Test' },
      error: null,
    });

    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'external-1',
        name: 'not-my-skill',
        author: {
          id: 'author-1',
          user_id: 'other-user', // Different user
        },
      },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/skills/import', {
      method: 'POST',
      body: JSON.stringify({ externalSkillId: 'external-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You can only import your own skills');
  });

  it('should return 409 if skill already imported', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com', name: 'Test' },
      error: null,
    });

    // External skill found with matching author
    mockSupabaseClient.single
      .mockResolvedValueOnce({
        data: {
          id: 'external-1',
          name: 'my-skill',
          slug: 'my-skill',
          repo: 'owner/repo',
          author: {
            id: 'author-1',
            user_id: 'user-1', // Same user
          },
          author_id: 'author-1',
        },
        error: null,
      })
      // Already imported
      .mockResolvedValueOnce({
        data: { id: 'existing-skill' },
        error: null,
      });

    const request = new NextRequest('http://localhost/api/skills/import', {
      method: 'POST',
      body: JSON.stringify({ externalSkillId: 'external-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('This skill has already been imported');
    expect(data.skillId).toBe('existing-skill');
  });

  it('should successfully import a skill', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com', name: 'Test' },
      error: null,
    });

    vi.mocked(parseTopSource).mockReturnValue({
      owner: 'owner',
      repo: 'repo',
      path: 'skills/my-skill',
    });

    vi.mocked(fetchGitHubContent).mockResolvedValue('# My Skill\n\nThis is my skill.');
    vi.mocked(fetchGitHubDirectory).mockResolvedValue([]);

    // External skill found
    mockSupabaseClient.single
      .mockResolvedValueOnce({
        data: {
          id: 'external-1',
          name: 'my-skill',
          slug: 'my-skill',
          description: 'A great skill',
          repo: 'owner/repo',
          repo_path: 'skills/my-skill',
          branch: 'main',
          raw_url: 'https://raw.githubusercontent.com/owner/repo/main/skills/my-skill/SKILL.md',
          github_owner: 'owner',
          author: {
            id: 'author-1',
            user_id: 'user-1',
          },
          author_id: 'author-1',
        },
        error: null,
      })
      // Not already imported
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      })
      // Slug check
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      })
      // Insert result
      .mockResolvedValueOnce({
        data: {
          id: 'new-skill-id',
          name: 'my-skill',
          slug: 'my-skill',
        },
        error: null,
      });

    mockSupabaseClient.rpc.mockResolvedValue({ error: null });

    const request = new NextRequest('http://localhost/api/skills/import', {
      method: 'POST',
      body: JSON.stringify({ externalSkillId: 'external-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.skill.id).toBe('new-skill-id');
    expect(data.skill.imported_from).toBe('external-1');
  });
});
