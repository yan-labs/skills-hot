'use client';

import { useTranslations } from 'next-intl';
import { Package, Download, Users, Clock } from 'lucide-react';

type StatsBarProps = {
  totalSkills: number;
  totalInstalls: number;
  totalAuthors: number;
  lastUpdated?: Date;
};

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function StatsBar({ totalSkills, totalInstalls, totalAuthors, lastUpdated }: StatsBarProps) {
  const t = useTranslations();

  const stats = [
    {
      icon: Package,
      value: formatNumber(totalSkills),
      label: t('statsBar.skills'),
      suffix: '+',
    },
    {
      icon: Download,
      value: formatNumber(totalInstalls),
      label: t('statsBar.installs'),
      suffix: '+',
    },
    {
      icon: Users,
      value: formatNumber(totalAuthors),
      label: t('statsBar.authors'),
      suffix: '+',
    },
  ];

  return (
    <div className="border-y border-border bg-muted/30 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Stats - horizontal scroll on mobile */}
        <div className="flex gap-6 overflow-x-auto sm:gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="flex flex-shrink-0 items-center gap-2 sm:gap-3"
            >
              <stat.icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-lg font-bold sm:text-xl">
                  {stat.value}
                </span>
                <span className="text-xs text-muted-foreground sm:text-sm">
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Last updated - hidden on mobile */}
        {lastUpdated && (
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Clock className="h-3 w-3" />
            <span>{t('statsBar.updated')}: {formatDate(lastUpdated, 'en')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
