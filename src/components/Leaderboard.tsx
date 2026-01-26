'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Flame, Star, ArrowUpRight, ChevronUp, ChevronDown, Minus } from 'lucide-react';

type Skill = {
  name: string;
  slug: string;
  author: string | null;
  installs: number;
  stars?: number;
  rankChange?: number; // positive = moved up, negative = moved down, 0 = no change
};

type LeaderboardProps = {
  mostInstalled: Skill[];
  mostStarred: Skill[];
  className?: string;
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

function RankChange({ change }: { change?: number }) {
  if (change === undefined || change === 0) {
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
  if (change > 0) {
    return (
      <span className="flex items-center text-green-600 dark:text-green-400">
        <ChevronUp className="h-3 w-3" />
        <span className="text-xs">{change}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center text-red-600 dark:text-red-400">
      <ChevronDown className="h-3 w-3" />
      <span className="text-xs">{Math.abs(change)}</span>
    </span>
  );
}

function LeaderboardColumn({
  title,
  icon: Icon,
  skills,
  valueKey,
  valueLabel,
}: {
  title: string;
  icon: React.ElementType;
  skills: Skill[];
  valueKey: 'installs' | 'stars';
  valueLabel: string;
}) {
  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2 border-b-2 border-foreground pb-2">
        <Icon className="h-4 w-4" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
      </div>

      {/* Table header */}
      <div className="mb-2 grid grid-cols-[24px_1fr_auto] gap-2 text-xs text-muted-foreground">
        <span>#</span>
        <span>SKILL</span>
        <span className="text-right">{valueLabel}</span>
      </div>

      {/* Skills list */}
      <div className="divide-y divide-border">
        {skills.map((skill, index) => (
          <Link
            key={skill.slug}
            href={`/skills/${skill.slug}`}
            className="group grid grid-cols-[24px_1fr_auto] items-center gap-2 py-3 transition-colors hover:bg-muted/50"
          >
            {/* Rank */}
            <div className="flex items-center gap-1">
              <span className="font-serif text-sm font-medium italic text-muted-foreground">
                {index + 1}
              </span>
            </div>

            {/* Skill info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium group-hover:underline">
                  {skill.name}
                </span>
                <ArrowUpRight className="h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              {skill.author && (
                <span className="text-xs text-muted-foreground">{skill.author}</span>
              )}
            </div>

            {/* Value */}
            <div className="flex items-center gap-2">
              <RankChange change={skill.rankChange} />
              <span className="font-mono text-sm tabular-nums">
                {formatNumber(skill[valueKey] || 0)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Leaderboard({ mostInstalled, mostStarred, className = '' }: LeaderboardProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<'installs' | 'stars'>('installs');

  return (
    <section className={`py-8 ${className}`}>
      {/* Section header */}
      <div className="mb-6">
        <p className="section-label mb-2">{t('leaderboard.badge')}</p>
        <h2 className="text-2xl sm:text-3xl">{t('leaderboard.title')}</h2>
      </div>

      {/* Desktop: Two columns side by side */}
      <div className="hidden gap-8 md:grid md:grid-cols-2">
        <LeaderboardColumn
          title={t('leaderboard.mostInstalled')}
          icon={Flame}
          skills={mostInstalled}
          valueKey="installs"
          valueLabel={t('leaderboard.installs')}
        />
        <LeaderboardColumn
          title={t('leaderboard.mostStarred')}
          icon={Star}
          skills={mostStarred}
          valueKey="stars"
          valueLabel={t('leaderboard.stars')}
        />
      </div>

      {/* Mobile: Tab switching */}
      <div className="md:hidden">
        {/* Tabs */}
        <div className="mb-4 flex border-b border-border">
          <button
            onClick={() => setActiveTab('installs')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'installs'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Flame className="h-4 w-4" />
            {t('leaderboard.mostInstalled')}
          </button>
          <button
            onClick={() => setActiveTab('stars')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'stars'
                ? 'border-b-2 border-foreground text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star className="h-4 w-4" />
            {t('leaderboard.mostStarred')}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'installs' ? (
          <LeaderboardColumn
            title={t('leaderboard.mostInstalled')}
            icon={Flame}
            skills={mostInstalled}
            valueKey="installs"
            valueLabel={t('leaderboard.installs')}
          />
        ) : (
          <LeaderboardColumn
            title={t('leaderboard.mostStarred')}
            icon={Star}
            skills={mostStarred}
            valueKey="stars"
            valueLabel={t('leaderboard.stars')}
          />
        )}
      </div>

    </section>
  );
}
