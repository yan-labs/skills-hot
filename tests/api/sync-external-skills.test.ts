import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock github-content
vi.mock('@/lib/github-content', () => ({
  parseTopSource: vi.fn((topSource: string) => {
    const parts = topSource.split('/');
    return {
      owner: parts[0] || '',
      repo: parts[1] || '',
      path: parts.length > 2 ? parts.slice(2).join('/') : null,
    };
  }),
  getGitHubRawUrl: vi.fn(
    (owner: string, repo: string, branch: string, path?: string | null) =>
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path ? path + '/' : ''}SKILL.md`
  ),
  fetchGitHubUser: vi.fn(),
  generateSlug: vi.fn((name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
}));

// Mock Supabase
const mockSelect = vi.fn();
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockImplementation(() => ({
    select: mockSelect,
  })),
  rpc: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { fetchGitHubUser } from '@/lib/github-content';
import { GET } from '@/app/api/cron/sync-external-skills/route';

describe('GET /api/cron/sync-external-skills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    // Reset default mock implementations
    mockSelect.mockResolvedValue({ data: [], error: null });
  });

  it('should return 401 if cron secret is wrong', async () => {
    const request = new Request('http://localhost/api/cron/sync-external-skills', {
      headers: { authorization: 'Bearer wrong-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 500 if database config is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const request = new Request('http://localhost/api/cron/sync-external-skills', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Supabase configuration missing');
  });

  it('should return 502 if skills.sh API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const request = new Request('http://localhost/api/cron/sync-external-skills', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toContain('skills.sh API error');
  });

  it('should return 502 if skills.sh returns invalid data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invalid: 'data' }),
    });

    const request = new Request('http://localhost/api/cron/sync-external-skills', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toBe('Invalid response from skills.sh');
  });

  it('should successfully sync skills', async () => {
    // Mock skills.sh response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          skills: [
            { name: 'skill-1', installs: 100, topSource: 'owner1/repo1' },
            { name: 'skill-2', installs: 200, topSource: 'owner2/repo2/path/to/skill' },
          ],
        }),
    });

    // Mock existing authors
    mockSupabaseClient.in.mockResolvedValueOnce({
      data: [{ id: 'author-1', github_login: 'owner1' }],
      error: null,
    });

    // Mock fetchGitHubUser for new authors
    vi.mocked(fetchGitHubUser).mockResolvedValue({
      id: 12345,
      login: 'owner2',
      name: 'Owner 2',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      bio: 'Test bio',
    });

    // Mock upsert operations - the first upsert (authors) uses .select(), rest don't
    mockSelect.mockResolvedValueOnce({
      data: [{ id: 'author-2', github_login: 'owner2' }],
      error: null,
    });

    // Mock RPC for updating author stats
    mockSupabaseClient.rpc.mockResolvedValue({ error: null });

    const request = new Request('http://localhost/api/cron/sync-external-skills', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.total).toBe(2);
    expect(data.processed).toBe(2);
    expect(data).toHaveProperty('syncedAt');
  });

  it('should skip skills without topSource', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          skills: [
            { name: 'skill-1', installs: 100, topSource: 'owner1/repo1' },
            { name: 'skill-no-source', installs: 50, topSource: '' },
            { name: 'skill-null-source', installs: 30 },
          ],
        }),
    });

    mockSupabaseClient.in.mockResolvedValueOnce({
      data: [{ id: 'author-1', github_login: 'owner1' }],
      error: null,
    });

    mockSupabaseClient.rpc.mockResolvedValue({ error: null });

    const request = new Request('http://localhost/api/cron/sync-external-skills', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.total).toBe(3);
    expect(data.processed).toBe(1); // Only skill-1 has valid topSource
  });

  it('should work without CRON_SECRET (for manual trigger)', async () => {
    delete process.env.CRON_SECRET;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          skills: [{ name: 'skill-1', installs: 100, topSource: 'owner1/repo1' }],
        }),
    });

    mockSupabaseClient.in.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    vi.mocked(fetchGitHubUser).mockResolvedValue({
      id: 12345,
      login: 'owner1',
      name: 'Owner 1',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      bio: null,
    });

    // Mock select for authors upsert
    mockSelect.mockResolvedValueOnce({
      data: [{ id: 'author-1', github_login: 'owner1' }],
      error: null,
    });

    mockSupabaseClient.rpc.mockResolvedValue({ error: null });

    const request = new Request('http://localhost/api/cron/sync-external-skills');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
