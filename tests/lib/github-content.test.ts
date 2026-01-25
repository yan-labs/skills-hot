import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseTopSource,
  getGitHubRawUrl,
  generateSlug,
  fetchGitHubContent,
  fetchGitHubUser,
  clearCache,
} from '@/lib/github-content';

describe('github-content', () => {
  describe('parseTopSource', () => {
    it('should parse simple owner/repo format', () => {
      const result = parseTopSource('anthropics/skills');
      expect(result).toEqual({
        owner: 'anthropics',
        repo: 'skills',
        path: null,
      });
    });

    it('should parse owner/repo/path format', () => {
      const result = parseTopSource('anthropics/skills/web-artifacts-builder');
      expect(result).toEqual({
        owner: 'anthropics',
        repo: 'skills',
        path: 'web-artifacts-builder',
      });
    });

    it('should parse deep path format', () => {
      const result = parseTopSource('owner/repo/skills/my-skill/v2');
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        path: 'skills/my-skill/v2',
      });
    });

    it('should handle empty string', () => {
      const result = parseTopSource('');
      expect(result).toEqual({
        owner: '',
        repo: '',
        path: null,
      });
    });
  });

  describe('getGitHubRawUrl', () => {
    it('should generate raw URL without path', () => {
      const url = getGitHubRawUrl('anthropics', 'skills', 'main');
      expect(url).toBe('https://raw.githubusercontent.com/anthropics/skills/main/SKILL.md');
    });

    it('should generate raw URL with path', () => {
      const url = getGitHubRawUrl('anthropics', 'skills', 'main', 'web-artifacts-builder');
      expect(url).toBe(
        'https://raw.githubusercontent.com/anthropics/skills/main/web-artifacts-builder/SKILL.md'
      );
    });

    it('should handle custom branch', () => {
      const url = getGitHubRawUrl('owner', 'repo', 'develop', 'path/to/skill');
      expect(url).toBe(
        'https://raw.githubusercontent.com/owner/repo/develop/path/to/skill/SKILL.md'
      );
    });

    it('should handle null path', () => {
      const url = getGitHubRawUrl('owner', 'repo', 'main', null);
      expect(url).toBe('https://raw.githubusercontent.com/owner/repo/main/SKILL.md');
    });
  });

  describe('generateSlug', () => {
    it('should convert to lowercase', () => {
      expect(generateSlug('MySkill')).toBe('myskill');
    });

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('my skill name')).toBe('my-skill-name');
    });

    it('should replace special characters', () => {
      expect(generateSlug('my@skill#name!')).toBe('my-skill-name');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(generateSlug('--my-skill--')).toBe('my-skill');
    });

    it('should handle multiple consecutive special characters', () => {
      expect(generateSlug('my___skill---name')).toBe('my-skill-name');
    });
  });

  describe('fetchGitHubContent', () => {
    beforeEach(() => {
      vi.resetAllMocks();
      clearCache();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch content from GitHub', async () => {
      const mockContent = '# Test Skill\n\nThis is a test.';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockContent),
      });

      const url = 'https://raw.githubusercontent.com/owner/repo/main/SKILL.md';
      const result = await fetchGitHubContent(url);

      expect(result).toBe(mockContent);
      expect(global.fetch).toHaveBeenCalledWith(url, expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'SkillBank/1.0',
        }),
      }));
    });

    it('should return error message on fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const url = 'https://raw.githubusercontent.com/owner/repo/main/SKILL.md';
      const result = await fetchGitHubContent(url);

      expect(result).toContain('Content Unavailable');
    });

    it('should return error message on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const url = 'https://raw.githubusercontent.com/owner/repo/main/SKILL.md';
      const result = await fetchGitHubContent(url);

      expect(result).toContain('Content Unavailable');
    });
  });

  describe('fetchGitHubUser', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch user info from GitHub', async () => {
      const mockUser = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        bio: 'A test user',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });

      const result = await fetchGitHubUser('testuser');

      expect(result).toEqual({
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        bio: 'A test user',
      });
    });

    it('should return null on fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await fetchGitHubUser('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await fetchGitHubUser('testuser');

      expect(result).toBeNull();
    });
  });
});
