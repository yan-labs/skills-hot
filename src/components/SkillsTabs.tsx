'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Globe, User, Briefcase } from 'lucide-react';

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
    { id: 'all' as Tab, label: t('tabs.all'), icon: Globe },
    { id: 'skillsmp' as Tab, label: 'SkillSMP', icon: Briefcase },
    ...(isAuthenticated
      ? [{ id: 'my' as Tab, label: t('tabs.my'), icon: User }]
      : []),
  ];

  return (
    <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? 'bg-background font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
