import Image from 'next/image';
import type { Platform } from '@/lib/supabase';
import { PLATFORMS } from '@/lib/supabase';

type PlatformBadgeProps = {
  platforms: Platform[] | null | undefined;
  compact?: boolean;
  showLabel?: boolean;
};

const ICON_URL = 'https://skills.sh/agents';

export function PlatformBadge({ platforms, compact = false, showLabel = true }: PlatformBadgeProps) {
  if (!platforms || platforms.length === 0) {
    return null;
  }

  // If only universal and compact mode, don't show anything
  if (platforms.length === 1 && platforms[0] === 'universal' && compact) {
    return null;
  }

  const platformIconMap: Record<Platform, string> = {
    amp: `${ICON_URL}/amp.svg`,
    antigravity: `${ICON_URL}/antigravity.svg`,
    claudecode: `${ICON_URL}/claude-code.svg`,
    clawdbot: `${ICON_URL}/clawdbot.svg`,
    cline: `${ICON_URL}/cline.svg`,
    codex: `${ICON_URL}/codex.svg`,
    copilot: `${ICON_URL}/copilot.svg`,
    cursor: `${ICON_URL}/cursor.svg`,
    droid: `${ICON_URL}/droid.svg`,
    gemini: `${ICON_URL}/gemini.svg`,
    goose: `${ICON_URL}/goose.svg`,
    kilo: `${ICON_URL}/kilo.svg`,
    'kiro-cli': `${ICON_URL}/kiro-cli.svg`,
    manus: `${ICON_URL}/claude-code.svg`, // Fallback
    moltbot: `${ICON_URL}/claude-code.svg`, // Fallback
    opencode: `${ICON_URL}/opencode.svg`,
    roo: `${ICON_URL}/roo.svg`,
    trae: `${ICON_URL}/trae.svg`,
    universal: `${ICON_URL}/claude-code.svg`, // Fallback
    windsurf: `${ICON_URL}/windsurf.svg`,
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {platforms.map((platform) => (
        <div key={platform} className="flex items-center gap-1">
          <Image
            src={platformIconMap[platform]}
            alt={PLATFORMS[platform]}
            width={16}
            height={16}
            unoptimized
          />
          {showLabel && (
            <span className="text-xs text-muted-foreground">
              {PLATFORMS[platform]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
