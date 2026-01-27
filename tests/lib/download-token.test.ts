import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateShortCode,
  generateDownloadToken,
  extractShortCode,
  isValidShortCode,
  hashToken,
  prepareTokenData,
  buildShortUrl,
  formatTimeRemaining,
  TOKEN_EXPIRY,
  TOKEN_USES,
} from '@/lib/download-token';

describe('download-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateShortCode', () => {
    it('should generate a 6-character code by default', () => {
      const code = generateShortCode();
      expect(code).toHaveLength(6);
    });

    it('should generate code with specified length', () => {
      const code = generateShortCode(8);
      expect(code).toHaveLength(8);
    });

    it('should only contain Base62 characters (excluding confusing ones)', () => {
      const code = generateShortCode(100);
      // Should not contain 0, O, 1, l, I
      expect(code).not.toMatch(/[0O1lI]/);
      // Should only contain valid Base62 characters
      expect(code).toMatch(/^[A-HJ-NP-Za-hj-km-np-z2-9]+$/);
    });

    it('should generate unique codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateShortCode());
      }
      // All 100 codes should be unique
      expect(codes.size).toBe(100);
    });
  });

  describe('generateDownloadToken', () => {
    it('should return shortCode and fullToken', () => {
      const result = generateDownloadToken();
      expect(result).toHaveProperty('shortCode');
      expect(result).toHaveProperty('fullToken');
    });

    it('should generate shortCode with 6 characters', () => {
      const { shortCode } = generateDownloadToken();
      expect(shortCode).toHaveLength(6);
    });

    it('should generate fullToken with correct format', () => {
      const { fullToken, shortCode } = generateDownloadToken();
      expect(fullToken).toMatch(/^dt_[A-Za-z0-9]{6}_[A-Za-z0-9]{16}$/);
      expect(fullToken).toContain(`dt_${shortCode}_`);
    });
  });

  describe('extractShortCode', () => {
    it('should extract shortCode from valid token', () => {
      const { shortCode, fullToken } = generateDownloadToken();
      const extracted = extractShortCode(fullToken);
      expect(extracted).toBe(shortCode);
    });

    it('should return null for invalid token format', () => {
      expect(extractShortCode('invalid')).toBeNull();
      expect(extractShortCode('dt_abc')).toBeNull();
      expect(extractShortCode('dt_12345_suffix')).toBeNull(); // too short
      expect(extractShortCode('')).toBeNull();
    });
  });

  describe('isValidShortCode', () => {
    it('should return true for valid 6-character codes', () => {
      expect(isValidShortCode('abcdef')).toBe(true);
      expect(isValidShortCode('ABC123')).toBe(true);
      expect(isValidShortCode('x7Kp2Q')).toBe(true);
    });

    it('should return false for invalid codes', () => {
      expect(isValidShortCode('abc')).toBe(false); // too short
      expect(isValidShortCode('abcdefgh')).toBe(false); // too long
      expect(isValidShortCode('abc-ef')).toBe(false); // invalid character
      expect(isValidShortCode('')).toBe(false);
    });
  });

  describe('hashToken', () => {
    it('should return SHA-256 hash as hex string', async () => {
      const hash = await hashToken('test-token');
      expect(hash).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('should return same hash for same input', async () => {
      const hash1 = await hashToken('same-token');
      const hash2 = await hashToken('same-token');
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different input', async () => {
      const hash1 = await hashToken('token-1');
      const hash2 = await hashToken('token-2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('prepareTokenData', () => {
    it('should return all required fields', async () => {
      const result = await prepareTokenData({
        skillId: 'skill-123',
        userId: 'user-456',
      });

      expect(result).toHaveProperty('shortCode');
      expect(result).toHaveProperty('fullToken');
      expect(result).toHaveProperty('tokenHash');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('maxUses');
    });

    it('should use default expiry (10 minutes)', async () => {
      const before = Date.now();
      const result = await prepareTokenData({
        skillId: 'skill-123',
        userId: 'user-456',
      });
      const after = Date.now();

      const expectedMin = before + TOKEN_EXPIRY.DEFAULT;
      const expectedMax = after + TOKEN_EXPIRY.DEFAULT;

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should respect custom expires_in', async () => {
      const before = Date.now();
      const result = await prepareTokenData({
        skillId: 'skill-123',
        userId: 'user-456',
        expiresIn: 300, // 5 minutes
      });

      const expected = before + 300 * 1000;
      // Allow 1 second tolerance
      expect(Math.abs(result.expiresAt.getTime() - expected)).toBeLessThan(1000);
    });

    it('should cap expires_in at MAX', async () => {
      const before = Date.now();
      const result = await prepareTokenData({
        skillId: 'skill-123',
        userId: 'user-456',
        expiresIn: 7200, // 2 hours (over max)
      });

      const expected = before + TOKEN_EXPIRY.MAX;
      expect(Math.abs(result.expiresAt.getTime() - expected)).toBeLessThan(1000);
    });

    it('should use default maxUses for git_clone purpose', async () => {
      const result = await prepareTokenData({
        skillId: 'skill-123',
        userId: 'user-456',
        purpose: 'git_clone',
      });

      expect(result.maxUses).toBe(TOKEN_USES.GIT_CLONE);
    });

    it('should respect custom maxUses', async () => {
      const result = await prepareTokenData({
        skillId: 'skill-123',
        userId: 'user-456',
        maxUses: 10,
      });

      expect(result.maxUses).toBe(10);
    });
  });

  describe('buildShortUrl', () => {
    it('should build all URL formats', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://skills.hot';

      const result = buildShortUrl('x7Kp2Q');

      expect(result.shortUrl).toBe('https://skills.hot/g/x7Kp2Q');
      expect(result.gitUrl).toBe('https://skills.hot/g/x7Kp2Q.git');
      expect(result.tarballUrl).toBe('https://skills.hot/g/x7Kp2Q/archive.tar.gz');
    });

    it('should use custom baseUrl', () => {
      const result = buildShortUrl('abc123', 'https://sk.io');

      expect(result.shortUrl).toBe('https://sk.io/g/abc123');
      expect(result.gitUrl).toBe('https://sk.io/g/abc123.git');
    });
  });

  describe('formatTimeRemaining', () => {
    it('should format minutes and seconds', () => {
      const future = new Date(Date.now() + 5 * 60 * 1000 + 30 * 1000); // 5m 30s
      const result = formatTimeRemaining(future);
      expect(result).toMatch(/^5m \d+s$/);
    });

    it('should format seconds only when less than 1 minute', () => {
      const future = new Date(Date.now() + 45 * 1000); // 45s
      const result = formatTimeRemaining(future);
      expect(result).toMatch(/^\d+s$/);
    });

    it('should return expired for past dates', () => {
      const past = new Date(Date.now() - 1000);
      const result = formatTimeRemaining(past);
      expect(result).toBe('expired');
    });

    it('should accept string dates', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      const result = formatTimeRemaining(future);
      expect(result).not.toBe('expired');
    });
  });
});
