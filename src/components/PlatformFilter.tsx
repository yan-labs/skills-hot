'use client';

import { PLATFORMS, type Platform } from '@/lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

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

export function PlatformFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('search');

  // Read selected platform from URL
  const selectedPlatform = (searchParams.get('platform') as Platform) || 'all';

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
      <span className="text-sm text-muted-foreground">{t('platform')}</span>
      <button
        onClick={() => handleFilter('all')}
        className={`text-sm px-2 py-1 rounded transition-all cursor-pointer ${
          selectedPlatform === 'all'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95'
        }`}
      >
        {t('all')}
      </button>
      {ALL_PLATFORMS.map((platform) => (
        <button
          key={platform}
          onClick={() => handleFilter(platform)}
          className={`text-sm px-2 py-1 rounded transition-all cursor-pointer ${
            selectedPlatform === platform
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95'
          }`}
        >
          {PLATFORMS[platform]}
        </button>
      ))}
    </div>
  );
}
