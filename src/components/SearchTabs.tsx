'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export type SearchType = 'skills' | 'authors' | 'repos';

export function SearchTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('search');

  const currentType = (searchParams.get('type') as SearchType) || 'skills';

  const handleTabChange = (type: SearchType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (type === 'skills') {
      params.delete('type');
    } else {
      params.set('type', type);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const tabs: { key: SearchType; label: string }[] = [
    { key: 'skills', label: t('tabs.skills') },
    { key: 'authors', label: t('tabs.authors') },
    { key: 'repos', label: t('tabs.repos') },
  ];

  return (
    <div className="flex gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleTabChange(tab.key)}
          className={`px-3 py-1.5 text-sm rounded transition-all cursor-pointer ${
            currentType === tab.key
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
