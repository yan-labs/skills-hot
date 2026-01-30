import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatformFilter } from '@/components/PlatformFilter';
import { useSearchParams, useRouter } from 'next/navigation';

// @vitest-environment happy-dom

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = {
  get: vi.fn(),
  toString: vi.fn(() => ''),
  has: vi.fn(),
  entries: vi.fn(),
  forEach: vi.fn(),
  keys: vi.fn(),
  values: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => mockSearchParams),
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
}));

describe('PlatformFilter Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render "Platform:" label', () => {
      render(<PlatformFilter />);
      expect(screen.getByText('Platform:')).toBeInTheDocument();
    });

    it('should render "All" button', () => {
      render(<PlatformFilter />);
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('should render all platform buttons', () => {
      render(<PlatformFilter />);
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
      expect(screen.getByText('Cursor')).toBeInTheDocument();
      expect(screen.getByText('Windsurf')).toBeInTheDocument();
      expect(screen.getByText('Codex')).toBeInTheDocument();
      expect(screen.getByText('Cline')).toBeInTheDocument();
      expect(screen.getByText('Copilot')).toBeInTheDocument();
      expect(screen.getByText('Gemini')).toBeInTheDocument();
      expect(screen.getByText('Universal')).toBeInTheDocument();
    });

    it('should highlight "All" button when no platform selected', () => {
      render(<PlatformFilter selectedPlatform="all" />);
      const allButton = screen.getByText('All');
      expect(allButton.className).toContain('bg-foreground');
    });

    it('should highlight selected platform button', () => {
      render(<PlatformFilter selectedPlatform="claudecode" />);
      const claudeButton = screen.getByText('Claude Code');
      expect(claudeButton.className).toContain('bg-foreground');
    });
  });

  describe('Filter Behavior', () => {
    it('should call router.push with "all" when All button clicked', () => {
      render(<PlatformFilter selectedPlatform="claudecode" />);
      const allButton = screen.getByText('All');
      fireEvent.click(allButton);
      expect(mockPush).toHaveBeenCalled();
    });

    it('should call router.push with platform when platform button clicked', () => {
      render(<PlatformFilter />);
      const claudeButton = screen.getByText('Claude Code');
      fireEvent.click(claudeButton);
      expect(mockPush).toHaveBeenCalled();
    });

    it('should maintain existing search params when changing filter', () => {
      mockSearchParams.toString.mockReturnValueOnce('q=test');
      render(<PlatformFilter />);
      const claudeButton = screen.getByText('Claude Code');
      fireEvent.click(claudeButton);
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('q=test'), expect.any(Object));
    });
  });

  describe('Default Props', () => {
    it('should default to "all" when selectedPlatform not provided', () => {
      render(<PlatformFilter />);
      const allButton = screen.getByText('All');
      expect(allButton.className).toContain('bg-foreground');
    });
  });
});
