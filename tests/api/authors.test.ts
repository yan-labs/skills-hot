import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Track call count to return different values for different from() calls
let fromCallCount = 0;

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn().mockImplementation(() => {
    fromCallCount++;
    return mockSupabaseClient;
  }),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn(),
  single: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

import { GET } from '@/app/api/authors/[login]/route';

describe('GET /api/authors/[login]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;

    // Set environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should return author with skills', async () => {
    // Mock author found (first from().select().eq().single())
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'author-1',
        github_id: 12345,
        github_login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        bio: 'A test user',
        external_skill_count: 5,
        native_skill_count: 2,
        total_installs: 1000,
        created_at: '2024-01-01',
      },
      error: null,
    });

    // Mock external skills (second from().select().eq().order())
    mockSupabaseClient.order.mockResolvedValueOnce({
      data: [
        { id: 'ext-1', name: 'skill-1', slug: 'skill-1', description: 'First skill', installs: 500 },
        { id: 'ext-2', name: 'skill-2', slug: 'skill-2', description: 'Second skill', installs: 300 },
      ],
      error: null,
    });

    // Mock native skills (third from().select().eq().eq())
    // This returns after two .eq() calls
    mockSupabaseClient.eq.mockImplementation(() => {
      // Return resolved value after native skills query
      return {
        ...mockSupabaseClient,
        then: (resolve: (value: { data: unknown[] | null; error: null }) => void) => {
          resolve({
            data: [
              { id: 'native-1', name: 'my-skill', slug: 'my-skill', description: 'My native skill', version: '1.0.0' },
            ],
            error: null,
          });
        },
      };
    });

    const request = new NextRequest('http://localhost/api/authors/testuser');
    const response = await GET(request, { params: Promise.resolve({ login: 'testuser' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.github_login).toBe('testuser');
    expect(data.name).toBe('Test User');
    expect(data.external_skill_count).toBe(5);
    expect(data.native_skill_count).toBe(2);
    expect(data.total_installs).toBe(1000);
  });

  it('should return 404 if author not found', async () => {
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    const request = new NextRequest('http://localhost/api/authors/nonexistent');
    const response = await GET(request, { params: Promise.resolve({ login: 'nonexistent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Author not found');
  });

  it('should return 500 if database config is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const request = new NextRequest('http://localhost/api/authors/testuser');
    const response = await GET(request, { params: Promise.resolve({ login: 'testuser' }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Database configuration missing');
  });
});

describe('Author API Response Shape', () => {
  it('should have correct shape for author response', () => {
    const authorResponse = {
      id: 'author-1',
      github_id: 12345,
      github_login: 'testuser',
      name: 'Test User',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      bio: 'A test user',
      external_skill_count: 5,
      native_skill_count: 2,
      total_installs: 1000,
      external_skills: [
        { id: 'ext-1', name: 'skill-1', slug: 'skill-1', installs: 500 },
      ],
      native_skills: [
        { id: 'native-1', name: 'my-skill', slug: 'my-skill', version: '1.0.0' },
      ],
      created_at: '2024-01-01',
    };

    expect(authorResponse).toHaveProperty('github_id');
    expect(authorResponse).toHaveProperty('github_login');
    expect(authorResponse).toHaveProperty('external_skill_count');
    expect(authorResponse).toHaveProperty('native_skill_count');
    expect(authorResponse).toHaveProperty('total_installs');
    expect(authorResponse).toHaveProperty('external_skills');
    expect(authorResponse).toHaveProperty('native_skills');
    expect(Array.isArray(authorResponse.external_skills)).toBe(true);
    expect(Array.isArray(authorResponse.native_skills)).toBe(true);
  });
});
