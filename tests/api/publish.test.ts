import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/skills/publish/route';

// Mock auth middleware
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}));

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn(),
    }),
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

import { verifyToken } from '@/lib/auth-middleware';

describe('POST /api/skills/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup environment variables
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  });

  it('should require authentication', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: null,
      error: { code: 'unauthorized', message: 'Not authenticated' },
    });

    const formData = new FormData();
    formData.append('metadata', JSON.stringify({ name: 'test' }));
    formData.append('content', '# Test');

    const request = new NextRequest('http://localhost/api/skills/publish', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('unauthorized');
  });

  it('should require metadata', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
      error: null,
    });

    const formData = new FormData();
    formData.append('content', '# Test');

    const request = new NextRequest('http://localhost/api/skills/publish', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('validation_error');
    expect(data.error_description).toContain('metadata');
  });

  it('should require content', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
      error: null,
    });

    const formData = new FormData();
    formData.append('metadata', JSON.stringify({ name: 'test' }));

    const request = new NextRequest('http://localhost/api/skills/publish', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('validation_error');
    expect(data.error_description).toContain('content');
  });

  it('should require name in metadata', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
      error: null,
    });

    const formData = new FormData();
    formData.append('metadata', JSON.stringify({ description: 'No name' }));
    formData.append('content', '# Test');

    const request = new NextRequest('http://localhost/api/skills/publish', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('validation_error');
    expect(data.error_description).toContain('name');
  });

  it('should create new skill successfully', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      error: null,
    });

    // No existing skill
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    // Insert succeeds
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'new-skill-id',
        name: 'my-skill',
        slug: 'my-skill',
        version: '1.0.0',
        has_files: false,
        is_private: false,
      },
      error: null,
    });

    const formData = new FormData();
    formData.append(
      'metadata',
      JSON.stringify({
        name: 'My Skill',
        description: 'A test skill',
        version: '1.0.0',
      })
    );
    formData.append('content', '# My Skill\n\nInstructions here.');

    const request = new NextRequest('http://localhost/api/skills/publish', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe('created');
    expect(data.skill.slug).toBe('my-skill');
  });

  it('should update existing skill owned by user', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      error: null,
    });

    // Existing skill owned by user
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'existing-id',
        slug: 'my-skill',
        user_id: 'user-123',
      },
      error: null,
    });

    // Update succeeds
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'existing-id',
        name: 'my-skill',
        slug: 'my-skill',
        version: '1.1.0',
        has_files: false,
        is_private: false,
      },
      error: null,
    });

    const formData = new FormData();
    formData.append(
      'metadata',
      JSON.stringify({
        name: 'My Skill',
        version: '1.1.0',
      })
    );
    formData.append('content', '# My Skill\n\nUpdated content.');

    const request = new NextRequest('http://localhost/api/skills/publish', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe('updated');
  });

  it('should reject update to skill owned by another user', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      error: null,
    });

    // Existing skill owned by different user
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'existing-id',
        slug: 'my-skill',
        user_id: 'other-user-456',
      },
      error: null,
    });

    const formData = new FormData();
    formData.append(
      'metadata',
      JSON.stringify({
        name: 'My Skill',
      })
    );
    formData.append('content', '# Trying to overwrite');

    const request = new NextRequest('http://localhost/api/skills/publish', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('permission_denied');
  });

  it('should publish private skill with is_private flag', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      error: null,
    });

    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'new-id',
        name: 'private-skill',
        slug: 'private-skill',
        version: '1.0.0',
        has_files: false,
        is_private: true,
      },
      error: null,
    });

    const formData = new FormData();
    formData.append(
      'metadata',
      JSON.stringify({
        name: 'Private Skill',
        is_private: true,
      })
    );
    formData.append('content', '# Private Skill');

    const request = new NextRequest('http://localhost/api/skills/publish', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.skill.is_private).toBe(true);
  });

  it('should handle invalid metadata JSON', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      error: null,
    });

    const formData = new FormData();
    formData.append('metadata', 'not valid json');
    formData.append('content', '# Test');

    const request = new NextRequest('http://localhost/api/skills/publish', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('validation_error');
    expect(data.error_description).toContain('Invalid metadata JSON');
  });

  it('should generate slug from skill name', async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      error: null,
    });

    mockSupabaseClient.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        id: 'new-id',
        name: 'My Awesome Skill!',
        slug: 'my-awesome-skill',
        version: '1.0.0',
        has_files: false,
        is_private: false,
      },
      error: null,
    });

    const formData = new FormData();
    formData.append(
      'metadata',
      JSON.stringify({
        name: 'My Awesome Skill!',
      })
    );
    formData.append('content', '# Test');

    const request = new NextRequest('http://localhost/api/skills/publish', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.skill.slug).toBe('my-awesome-skill');
  });
});
