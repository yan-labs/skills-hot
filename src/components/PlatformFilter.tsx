'use client';

import { PLATFORMS, type Platform } from '@/lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';

const ALL_PLATFORMS: Platform[] = [
  'claudecode',
  'cursor',
  'windsurf',
  'codex',
  'cline',
  'copilot',
  'gemini',
  'universal',
];

type PlatformFilterProps = {
  selectedPlatform?: Platform | 'all';
};

export function PlatformFilter({ selectedPlatform = 'all' }: PlatformFilterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleFilter = (platform: Platform | 'all') => {
    const params = new URLSearchParams(searchParams.toString());
    if (platform === 'all') {
      params.delete('platform');
    } else {
      params.set('platform', platform);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Platform:</span>
      <button
        onClick={() => handleFilter('all')}
        className={`text-sm px-2 py-1 rounded transition-colors ${
          selectedPlatform === 'all'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        All
      </button>
      {ALL_PLATFORMS.map((platform) => (
        <button
          key={platform}
          onClick={() => handleFilter(platform)}
          className={`text-sm px-2 py-1 rounded transition-colors ${
            selectedPlatform === platform
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {PLATFORMS[platform]}
        </button>
      ))}
    </div>
  );
}
