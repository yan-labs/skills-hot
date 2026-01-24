import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyToken } from '@/lib/auth-middleware';

// Mock crypto.subtle for token hashing
const mockDigest = vi.fn();
vi.stubGlobal('crypto', {
  subtle: {
    digest: mockDigest,
  },
});

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  update: vi.fn().mockReturnThis(),
  auth: {
    admin: {
      getUserById: vi.fn(),
    },
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('auth-middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup environment variables
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');

    // Default hash mock
    mockDigest.mockResolvedValue(new ArrayBuffer(32));
  });

  describe('verifyToken', () => {
    it('should return error when no auth header provided', async () => {
      const result = await verifyToken(null);

      expect(result.user).toBeNull();
      expect(result.error?.code).toBe('unauthorized');
      expect(result.error?.message).toContain('Authorization header');
    });

    it('should return error for invalid header format', async () => {
      const result = await verifyToken('InvalidFormat');

      expect(result.user).toBeNull();
      expect(result.error?.code).toBe('invalid_token');
      expect(result.error?.message).toContain('Invalid authorization header');
    });

    it('should return error for non-Bearer auth', async () => {
      const result = await verifyToken('Basic abc123');

      expect(result.user).toBeNull();
      expect(result.error?.code).toBe('invalid_token');
    });

    it('should return error for invalid token format (not starting with sb_)', async () => {
      const result = await verifyToken('Bearer invalid_token');

      expect(result.user).toBeNull();
      expect(result.error?.code).toBe('invalid_token');
      expect(result.error?.message).toContain('Invalid token format');
    });

    it('should return error when server config is missing', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');

      const result = await verifyToken('Bearer sb_test_token');

      expect(result.user).toBeNull();
      expect(result.error?.code).toBe('server_error');
    });

    it('should return error when token not found in database', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await verifyToken('Bearer sb_test_token');

      expect(result.user).toBeNull();
      expect(result.error?.code).toBe('invalid_token');
      expect(result.error?.message).toContain('not found');
    });

    it('should return error when token is revoked', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'token-1',
          user_id: 'user-1',
          revoked_at: new Date().toISOString(),
        },
        error: null,
      });

      const result = await verifyToken('Bearer sb_test_token');

      expect(result.user).toBeNull();
      expect(result.error?.code).toBe('invalid_token');
      expect(result.error?.message).toContain('revoked');
    });

    it('should return error when token is expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'token-1',
          user_id: 'user-1',
          revoked_at: null,
          expires_at: pastDate.toISOString(),
        },
        error: null,
      });

      const result = await verifyToken('Bearer sb_test_token');

      expect(result.user).toBeNull();
      expect(result.error?.code).toBe('invalid_token');
      expect(result.error?.message).toContain('expired');
    });

    it('should return user when token is valid', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'token-1',
          user_id: 'user-123',
          revoked_at: null,
          expires_at: futureDate.toISOString(),
        },
        error: null,
      });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
          },
        },
        error: null,
      });

      const result = await verifyToken('Bearer sb_test_token');

      expect(result.error).toBeNull();
      expect(result.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should return user with email prefix when name is not set', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'token-1',
          user_id: 'user-123',
          revoked_at: null,
          expires_at: futureDate.toISOString(),
        },
        error: null,
      });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'developer@company.com',
            user_metadata: {},
          },
        },
        error: null,
      });

      const result = await verifyToken('Bearer sb_test_token');

      expect(result.error).toBeNull();
      expect(result.user?.name).toBe('developer');
    });

    it('should update last_used_at after successful verification', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'token-1',
          user_id: 'user-123',
          revoked_at: null,
          expires_at: futureDate.toISOString(),
        },
        error: null,
      });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValueOnce({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            user_metadata: { name: 'Test User' },
          },
        },
        error: null,
      });

      await verifyToken('Bearer sb_test_token');

      expect(mockSupabaseClient.update).toHaveBeenCalled();
    });

    it('should return error when user lookup fails', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'token-1',
          user_id: 'user-123',
          revoked_at: null,
          expires_at: futureDate.toISOString(),
        },
        error: null,
      });

      mockSupabaseClient.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'User not found' },
      });

      const result = await verifyToken('Bearer sb_test_token');

      expect(result.user).toBeNull();
      expect(result.error?.code).toBe('server_error');
    });
  });
});
