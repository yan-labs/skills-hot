import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformBadge } from '@/components/PlatformBadge';

// @vitest-environment happy-dom

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ alt, src, width, height }: any) => (
    <img alt={alt} src={src} width={width} height={height} data-testid="platform-icon" />
  ),
}));

describe('PlatformBadge Component', () => {
  describe('Rendering', () => {
    it('should render nothing when platforms is null', () => {
      const { container } = render(<PlatformBadge platforms={null} />);
      expect(container.firstChild).toBe(null);
    });

    it('should render nothing when platforms is undefined', () => {
      const { container } = render(<PlatformBadge platforms={undefined} />);
      expect(container.firstChild).toBe(null);
    });

    it('should render nothing when platforms is empty array', () => {
      const { container } = render(<PlatformBadge platforms={[]} />);
      expect(container.firstChild).toBe(null);
    });

    it('should render single platform icon', () => {
      render(<PlatformBadge platforms={['claudecode']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons).toHaveLength(1);
      expect(icons[0]).toHaveAttribute('src', 'https://skills.sh/agents/claude-code.svg');
      expect(icons[0]).toHaveAttribute('alt', 'Claude Code');
    });

    it('should render multiple platform icons', () => {
      render(<PlatformBadge platforms={['claudecode', 'cursor', 'windsurf']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons).toHaveLength(3);
    });

    it('should render platform labels by default', () => {
      render(<PlatformBadge platforms={['claudecode', 'cursor']} />);
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
      expect(screen.getByText('Cursor')).toBeInTheDocument();
    });

    it('should not render platform labels when showLabel is false', () => {
      render(<PlatformBadge platforms={['claudecode']} showLabel={false} />);
      expect(screen.queryByText('Claude Code')).not.toBeInTheDocument();
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons).toHaveLength(1);
    });

    it('should render nothing for universal platform in compact mode', () => {
      const { container } = render(<PlatformBadge platforms={['universal']} compact />);
      expect(container.firstChild).toBe(null);
    });

    it('should render universal platform in compact mode with other platforms', () => {
      render(<PlatformBadge platforms={['universal', 'claudecode']} compact />);
      expect(screen.getByText('Universal')).toBeInTheDocument();
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });

    it('should render universal platform when not in compact mode', () => {
      render(<PlatformBadge platforms={['universal']} compact={false} />);
      expect(screen.getByText('Universal')).toBeInTheDocument();
    });
  });

  describe('Icon URLs', () => {
    it('should use correct icon URL for Claude Code', () => {
      render(<PlatformBadge platforms={['claudecode']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons[0]).toHaveAttribute('src', 'https://skills.sh/agents/claude-code.svg');
    });

    it('should use correct icon URL for Cursor', () => {
      render(<PlatformBadge platforms={['cursor']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons[0]).toHaveAttribute('src', 'https://skills.sh/agents/cursor.svg');
    });

    it('should use correct icon URL for Windsurf', () => {
      render(<PlatformBadge platforms={['windsurf']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons[0]).toHaveAttribute('src', 'https://skills.sh/agents/windsurf.svg');
    });

    it('should use correct icon URL for Cline', () => {
      render(<PlatformBadge platforms={['cline']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons[0]).toHaveAttribute('src', 'https://skills.sh/agents/cline.svg');
    });

    it('should use correct icon URL for Codex', () => {
      render(<PlatformBadge platforms={['codex']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons[0]).toHaveAttribute('src', 'https://skills.sh/agents/codex.svg');
    });

    it('should use correct icon URL for Copilot', () => {
      render(<PlatformBadge platforms={['copilot']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons[0]).toHaveAttribute('src', 'https://skills.sh/agents/copilot.svg');
    });

    it('should use correct icon URL for Gemini', () => {
      render(<PlatformBadge platforms={['gemini']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons[0]).toHaveAttribute('src', 'https://skills.sh/agents/gemini.svg');
    });

    it('should use fallback icon for OpenCode', () => {
      render(<PlatformBadge platforms={['opencode']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons[0]).toHaveAttribute('src', 'https://skills.sh/agents/opencode.svg');
    });

    it('should use fallback icon for Manus', () => {
      render(<PlatformBadge platforms={['manus']} />);
      const icons = screen.getAllByTestId('platform-icon');
      expect(icons[0]).toHaveAttribute('src', 'https://skills.sh/agents/claude-code.svg');
    });
  });

  describe('Platform Names', () => {
    it('should display correct platform names', () => {
      render(<PlatformBadge platforms={['claudecode', 'cursor', 'cline']} />);
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
      expect(screen.getByText('Cursor')).toBeInTheDocument();
      expect(screen.getByText('Cline')).toBeInTheDocument();
    });
  });
});
