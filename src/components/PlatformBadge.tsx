'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Platform } from '@/lib/supabase';
import { PLATFORMS } from '@/lib/supabase';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type PlatformBadgeProps = {
  platforms: Platform[] | null | undefined;
  compact?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  scrollable?: boolean;
};

// 统一使用 skills.sh 的图标
const ICON_CDN = 'https://skills.sh/agents';

const sizeMap = {
  sm: 20,
  md: 32,
  lg: 48,
  xl: 56,
};

// 支持 skills 的所有平台（Universal 时显示这些，按热门程度排序）
const MAIN_PLATFORMS: Platform[] = [
  'claudecode',
  'codex',
  'cursor',
  'antigravity',
  'gemini',
  'copilot',
  'windsurf',
  'cline',
  'roo',
  'amp',
  'trae',
  'goose',
  'kiro-cli',
  'opencode',
  'kilo',
  'droid',
  'clawdbot',
];

const platformIconMap: Record<Platform, string> = {
  aider: `${ICON_CDN}/aider.svg`,
  amp: `${ICON_CDN}/amp.svg`,
  antigravity: `${ICON_CDN}/antigravity.svg`,
  claudecode: `${ICON_CDN}/claude-code.svg`,
  clawdbot: `${ICON_CDN}/clawdbot.svg`,
  cline: `${ICON_CDN}/cline.svg`,
  codex: `${ICON_CDN}/codex.svg`,
  copilot: `${ICON_CDN}/copilot.svg`,
  cursor: `${ICON_CDN}/cursor.svg`,
  droid: `${ICON_CDN}/droid.svg`,
  gemini: `${ICON_CDN}/gemini.svg`,
  goose: `${ICON_CDN}/goose.svg`,
  kilo: `${ICON_CDN}/kilo.svg`,
  'kiro-cli': `${ICON_CDN}/kiro-cli.svg`,
  manus: `${ICON_CDN}/manus.svg`,
  moltbot: `${ICON_CDN}/moltbot.svg`,
  openclaw: `${ICON_CDN}/openclaw.svg`,
  opencode: `${ICON_CDN}/opencode.svg`,
  roo: `${ICON_CDN}/roo.svg`,
  trae: `${ICON_CDN}/trae.svg`,
  universal: `${ICON_CDN}/claude-code.svg`,
  windsurf: `${ICON_CDN}/windsurf.svg`,
};

export function PlatformBadge({ platforms, compact = false, showLabel = true, size = 'sm', scrollable = false }: PlatformBadgeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!platforms || platforms.length === 0) {
    return null;
  }

  // If only universal and compact mode, don't show anything
  if (platforms.length === 1 && platforms[0] === 'universal' && compact) {
    return null;
  }

  const iconSize = sizeMap[size];

  // 如果是 Universal，显示主要平台的图标
  const isUniversal = platforms.length === 1 && platforms[0] === 'universal';
  const displayPlatforms = isUniversal ? MAIN_PLATFORMS : platforms;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = iconSize * 3;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (scrollable) {
    return (
      <div className="group relative flex items-center">
        {/* 左侧渐变 + 按钮 */}
        <div className="absolute left-0 z-10 flex h-full items-center bg-gradient-to-r from-black via-black/80 to-transparent pl-1 pr-4">
          <button
            onClick={() => scroll('left')}
            className="p-1 text-white/0 group-hover:text-white/60 hover:!text-white transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-10"
          style={{ scrollbarWidth: 'none' }}
        >
          {displayPlatforms.map((platform) => (
            <Tooltip key={platform}>
              <TooltipTrigger asChild>
                <div className="flex-shrink-0">
                  <Image
                    src={platformIconMap[platform]}
                    alt={PLATFORMS[platform]}
                    width={iconSize}
                    height={iconSize}
                    unoptimized
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{PLATFORMS[platform]}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* 右侧渐变 + 按钮 */}
        <div className="absolute right-0 z-10 flex h-full items-center bg-gradient-to-l from-black via-black/80 to-transparent pr-1 pl-4">
          <button
            onClick={() => scroll('right')}
            className="p-1 text-white/0 group-hover:text-white/60 hover:!text-white transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      {displayPlatforms.map((platform, i) => (
        <div key={platform} className="flex flex-shrink-0 cursor-pointer items-center gap-1.5 transition-transform hover:scale-105">
          <Tooltip>
            <TooltipTrigger asChild>
              <Image
                src={platformIconMap[platform]}
                alt={PLATFORMS[platform]}
                width={iconSize}
                height={iconSize}
                unoptimized
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{PLATFORMS[platform]}</p>
            </TooltipContent>
          </Tooltip>
          {showLabel && (
            <span className={size === 'sm' ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>
              {PLATFORMS[platform]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
