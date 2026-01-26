'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

type Tab = 'all' | 'my' | 'skillsmp';

type SkillsTabsProps = {
  currentTab: Tab;
  isAuthenticated: boolean;
};

export function SkillsTabs({ currentTab, isAuthenticated }: SkillsTabsProps) {
  const t = useTranslations('skills');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleTabChange = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'all') {
      params.delete('source');
    } else {
      params.set('source', tab);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const tabs = [
    { id: 'all' as Tab, label: t('tabs.all') },
    { id: 'skillsmp' as Tab, label: 'SkillSMP' },
    ...(isAuthenticated
      ? [{ id: 'my' as Tab, label: t('tabs.my') }]
      : []),
  ];

  return (
    <div className="flex gap-4">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`text-sm transition-colors ${
              isActive
                ? 'text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
