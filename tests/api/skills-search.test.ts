import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();
const mockContains = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

mockSelect.mockReturnValue({
  eq: mockEq,
  or: mockOr,
  order: mockOrder,
  limit: mockLimit,
});

mockEq.mockReturnValue({
  or: mockOr,
  contains: mockContains,
  limit: mockLimit,
});

mockOr.mockReturnValue({
  contains: mockContains,
  order: mockOrder,
  limit: mockLimit,
});

mockContains.mockReturnValue({
  limit: mockLimit,
});

mockOrder.mockReturnValue({
  limit: mockLimit,
});

mockLimit.mockResolvedValue({
  data: [],
  error: null,
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('GET /api/skills/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should return empty results when no skills found', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    const { GET } = await import('@/app/api/skills/search/route');
    const request = new Request('http://localhost/api/skills/search?q=nonexistent');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.skills).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.hasMore).toBe(false);
  });

  it('should search both local and external skills', async () => {
    const mockLocalSkills = [
      {
        id: '1',
        name: 'Test Skill',
        slug: 'test-skill',
        description: 'A test skill',
        author: 'testuser',
        category: 'testing',
        tags: ['test'],
        platforms: ['claudecode'],
        skill_stats: [{ installs: 100 }],
      },
    ];

    const mockExternalSkills = [
      {
        id: '2',
        name: 'External Skill',
        slug: 'external-skill',
        description: 'An external skill',
        github_owner: 'externaluser',
        installs: 50,
      },
    ];

    // First call returns local skills, second returns external
    let callCount = 0;
    mockLimit.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: mockLocalSkills, error: null });
      }
      return Promise.resolve({ data: mockExternalSkills, error: null });
    });

    const { GET } = await import('@/app/api/skills/search/route');
    const request = new Request('http://localhost/api/skills/search?q=skill');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.skills.length).toBe(2);
    // Should be sorted by installs (100 > 50)
    expect(data.skills[0].name).toBe('Test Skill');
    expect(data.skills[1].name).toBe('External Skill');
  });

  it('should deduplicate skills by slug', async () => {
    const mockLocalSkills = [
      {
        id: '1',
        name: 'Duplicate Skill',
        slug: 'duplicate-skill',
        description: 'Local version',
        author: 'user1',
        category: null,
        tags: null,
        platforms: null,
        skill_stats: [{ installs: 100 }],
      },
    ];

    const mockExternalSkills = [
      {
        id: '2',
        name: 'Duplicate Skill',
        slug: 'duplicate-skill',
        description: 'External version',
        github_owner: 'user2',
        installs: 50,
      },
    ];

    let callCount = 0;
    mockLimit.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: mockLocalSkills, error: null });
      }
      return Promise.resolve({ data: mockExternalSkills, error: null });
    });

    const { GET } = await import('@/app/api/skills/search/route');
    const request = new Request('http://localhost/api/skills/search?q=duplicate');
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should only have one result (deduplicated)
    expect(data.skills.length).toBe(1);
    // Should keep the one with higher installs
    expect(data.skills[0].installs).toBe(100);
  });

  it('should handle pagination correctly', async () => {
    // Create 25 mock skills
    const mockSkills = Array.from({ length: 25 }, (_, i) => ({
      id: `${i}`,
      name: `Skill ${i}`,
      slug: `skill-${i}`,
      description: `Description ${i}`,
      author: 'user',
      category: null,
      tags: null,
      platforms: null,
      skill_stats: [{ installs: 100 - i }],
    }));

    mockLimit.mockResolvedValue({ data: mockSkills, error: null });

    const { GET } = await import('@/app/api/skills/search/route');

    // First page
    const request1 = new Request('http://localhost/api/skills/search?page=1');
    const response1 = await GET(request1 as any);
    const data1 = await response1.json();

    expect(data1.page).toBe(1);
    expect(data1.skills.length).toBe(20); // PAGE_SIZE
    expect(data1.hasMore).toBe(true);

    // Second page
    const request2 = new Request('http://localhost/api/skills/search?page=2');
    const response2 = await GET(request2 as any);
    const data2 = await response2.json();

    expect(data2.page).toBe(2);
    expect(data2.skills.length).toBe(5); // Remaining skills
    expect(data2.hasMore).toBe(false);
  });

  it('should filter by platform', async () => {
    const { GET } = await import('@/app/api/skills/search/route');
    const request = new Request('http://localhost/api/skills/search?platform=claudecode');
    await GET(request as any);

    // Should have called contains for platform filter
    expect(mockContains).toHaveBeenCalled();
  });

  it('should return 500 on server configuration error', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Need to re-import to get fresh module
    vi.resetModules();
    const { GET } = await import('@/app/api/skills/search/route');
    const request = new Request('http://localhost/api/skills/search?q=test');
    const response = await GET(request as any);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Server configuration error');
  });
});
