import { describe, it, expect } from 'vitest';
import { PLATFORMS, type Platform } from '@/lib/supabase';

describe('supabase Platform types', () => {
  describe('PLATFORMS constant', () => {
    it('should have all platform display names', () => {
      expect(Object.keys(PLATFORMS)).toHaveLength(20);
    });

    it('should contain all required platforms', () => {
      const expectedPlatforms: Platform[] = [
        'amp',
        'antigravity',
        'claudecode',
        'clawdbot',
        'cline',
        'codex',
        'copilot',
        'cursor',
        'droid',
        'gemini',
        'goose',
        'kilo',
        'kiro-cli',
        'manus',
        'moltbot',
        'opencode',
        'roo',
        'trae',
        'universal',
        'windsurf',
      ];

      expectedPlatforms.forEach((platform) => {
        expect(PLATFORMS[platform]).toBeDefined();
        expect(typeof PLATFORMS[platform]).toBe('string');
      });
    });

    it('should have correct display names for key platforms', () => {
      expect(PLATFORMS.claudecode).toBe('Claude Code');
      expect(PLATFORMS.cursor).toBe('Cursor');
      expect(PLATFORMS.windsurf).toBe('Windsurf');
      expect(PLATFORMS.cline).toBe('Cline');
      expect(PLATFORMS.codex).toBe('Codex');
      expect(PLATFORMS.copilot).toBe('Copilot');
      expect(PLATFORMS.gemini).toBe('Gemini');
      expect(PLATFORMS.opencode).toBe('OpenCode');
      expect(PLATFORMS.universal).toBe('Universal');
    });
  });

  describe('Platform type', () => {
    it('should accept valid platform values', () => {
      const validPlatforms: Platform[] = [
        'claudecode',
        'cursor',
        'windsurf',
        'codex',
        'cline',
        'copilot',
        'gemini',
        'universal',
        'opencode',
      ];

      validPlatforms.forEach((platform) => {
        expect(platform).toEqual(expect.any(String));
      });
    });
  });
});
