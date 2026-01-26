import { describe, it, expect } from 'vitest';
import {
  createGitPack,
  generateInfoRefs,
  generateHead,
  getObject,
  parseObjectPath,
} from '@/lib/git-pack';

describe('git-pack', () => {
  describe('createGitPack', () => {
    it('should create a git pack with required fields', async () => {
      const pack = await createGitPack('test-skill', '# Test Skill\n\nThis is a test.');

      expect(pack).toHaveProperty('objects');
      expect(pack).toHaveProperty('refs');
      expect(pack).toHaveProperty('headCommit');
    });

    it('should create at least 3 objects (blob, tree, commit)', async () => {
      const pack = await createGitPack('test-skill', '# Test');

      // Should have blob, tree, and commit
      expect(pack.objects.size).toBeGreaterThanOrEqual(3);
    });

    it('should have refs/heads/main and HEAD pointing to commit', async () => {
      const pack = await createGitPack('test-skill', '# Test');

      expect(pack.refs['refs/heads/main']).toBe(pack.headCommit);
      expect(pack.refs['HEAD']).toBe(pack.headCommit);
    });

    it('should create unique SHA for different content', async () => {
      const pack1 = await createGitPack('skill-1', 'Content 1');
      const pack2 = await createGitPack('skill-2', 'Content 2');

      expect(pack1.headCommit).not.toBe(pack2.headCommit);
    });

    it('should handle additional files', async () => {
      const additionalFiles = new Map([
        ['README.md', '# README'],
        ['script.sh', '#!/bin/bash'],
      ]);

      const pack = await createGitPack('test-skill', '# Skill', additionalFiles);

      // Should have more objects: 3 blobs + 1 tree + 1 commit = 5
      expect(pack.objects.size).toBeGreaterThanOrEqual(5);
    });

    it('should produce valid SHA-1 hashes (40 hex chars)', async () => {
      const pack = await createGitPack('test', 'content');

      for (const sha of pack.objects.keys()) {
        expect(sha).toMatch(/^[a-f0-9]{40}$/);
      }

      expect(pack.headCommit).toMatch(/^[a-f0-9]{40}$/);
    });
  });

  describe('generateInfoRefs', () => {
    it('should generate refs in correct format', async () => {
      const pack = await createGitPack('test', 'content');
      const refs = generateInfoRefs(pack);

      // Format: {sha}\t{ref}\n
      expect(refs).toContain('\trefs/heads/main\n');
      expect(refs).toContain(pack.headCommit);
    });

    it('should not include HEAD in refs output', async () => {
      const pack = await createGitPack('test', 'content');
      const refs = generateInfoRefs(pack);

      expect(refs).not.toContain('\tHEAD');
    });
  });

  describe('generateHead', () => {
    it('should return ref to main branch', () => {
      const head = generateHead();

      expect(head).toBe('ref: refs/heads/main\n');
    });
  });

  describe('getObject', () => {
    it('should return object data for valid SHA', async () => {
      const pack = await createGitPack('test', 'content');
      const sha = pack.headCommit;

      const data = getObject(pack, sha);

      expect(data).not.toBeNull();
      expect(data).toBeInstanceOf(Uint8Array);
      expect(data!.length).toBeGreaterThan(0);
    });

    it('should return null for invalid SHA', async () => {
      const pack = await createGitPack('test', 'content');

      const data = getObject(pack, 'invalid-sha-that-does-not-exist');

      expect(data).toBeNull();
    });

    it('should return compressed data', async () => {
      const pack = await createGitPack('test', 'content');
      const sha = pack.headCommit;

      const data = getObject(pack, sha);

      // zlib compressed data typically starts with 0x78
      expect(data![0]).toBe(0x78);
    });
  });

  describe('parseObjectPath', () => {
    it('should parse valid object path', () => {
      const sha = parseObjectPath('objects/ab/cdef1234567890abcdef1234567890abcdef12');

      expect(sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    });

    it('should return null for invalid paths', () => {
      expect(parseObjectPath('objects/ab')).toBeNull();
      expect(parseObjectPath('invalid/path')).toBeNull();
      expect(parseObjectPath('objects/zz/invalid')).toBeNull();
      expect(parseObjectPath('')).toBeNull();
    });

    it('should handle various valid SHA lengths', () => {
      // Short SHA (minimum for Git)
      const short = parseObjectPath('objects/ab/cdef12');
      expect(short).toBe('abcdef12');

      // Full SHA-1
      const full = parseObjectPath('objects/12/34567890abcdef1234567890abcdef12345678');
      expect(full).toBe('1234567890abcdef1234567890abcdef12345678');
    });
  });
});
