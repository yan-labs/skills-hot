'use client';

import { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Flame, Star, ArrowUpRight, ChevronUp, ChevronDown, Minus, Loader2 } from 'lucide-react';
import Image from 'next/image';

type Skill = {
  name: string;
  slug: string;
  author: string | null;
  installs: number;
  stars?: number;
  rankChange?: number;
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
    return <Minus className="h-3 w-3 text-muted-foreground/50" />;
  }
  if (change > 0) {
    return (
      <span className="flex items-center text-green-600 dark:text-green-400">
        <ChevronUp className="h-3 w-3" />
        <span className="text-[10px]">{change}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center text-red-500 dark:text-red-400">
      <ChevronDown className="h-3 w-3" />
      <span className="text-[10px]">{Math.abs(change)}</span>
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const colors = ['bg-yellow-500', 'bg-gray-400', 'bg-amber-600'];
    return (
      <div className={`flex h-6 w-6 items-center justify-center rounded-full ${colors[rank - 1]} text-xs font-bold text-white`}>
        {rank}
      </div>
    );
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center text-sm text-muted-foreground">
      {rank}
    </div>
  );
}

type LeaderboardColumnHandle = {
  loadMore: () => Promise<void>;
  loading: boolean;
  hasMore: boolean;
};

type LeaderboardColumnProps = {
  title: string;
  icon: React.ElementType;
  initialSkills: Skill[];
  valueKey: 'installs' | 'stars';
  accentColor: string;
  sortBy: 'installs' | 'stars';
  initialOffset: number;
};

const LeaderboardColumn = forwardRef<LeaderboardColumnHandle, LeaderboardColumnProps>(
  function LeaderboardColumn({ title, icon: Icon, initialSkills, valueKey, accentColor, sortBy, initialOffset }, ref) {
    const [skills, setSkills] = useState<Skill[]>(initialSkills);
    const [nextOffset, setNextOffset] = useState(initialOffset);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const loadingRef = useRef(false);

    const loadMore = async () => {
      if (loadingRef.current || !hasMore) return;
      loadingRef.current = true;
      setLoading(true);

      try {
        const res = await fetch(`/api/leaderboard?sortBy=${sortBy}&offset=${nextOffset}`);
        if (!res.ok) throw new Error('Failed to load');

        const data = await res.json();
        setSkills(prev => [...prev, ...data.skills]);
        setNextOffset(data.nextOffset);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error('Failed to load more:', error);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };

    useImperativeHandle(ref, () => ({
      loadMore,
      get loading() { return loading; },
      get hasMore() { return hasMore; },
    }), [loading, hasMore]);

    return (
      <div className="rounded-lg bg-muted/30 p-4">
        {/* Header */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${accentColor}15` }}>
            <Icon className="h-4 w-4" style={{ color: accentColor }} />
          </div>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>

        {/* Skills list */}
        <div className="space-y-1">
          {skills.map((skill, index) => {
            const avatarUrl = skill.author ? `https://github.com/${skill.author}.png?size=48` : null;

            return (
              <Link
                key={`${skill.slug}-${index}`}
                href={`/skills/${skill.slug}`}
                className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-background/80"
              >
                {/* Rank */}
                <RankBadge rank={index + 1} />

                {/* Avatar */}
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={skill.author || ''}
                    width={28}
                    height={28}
                    unoptimized
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    ?
                  </div>
                )}

                {/* Skill info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium group-hover:underline">
                      {skill.name}
                    </span>
                    <ArrowUpRight className="h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  {skill.author && (
                    <span className="text-xs text-muted-foreground">{skill.author}</span>
                  )}
                </div>

                {/* Value */}
                <div className="flex items-center gap-1.5">
                  <RankChange change={skill.rankChange} />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatNumber(skill[valueKey] || 0)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }
);

export function Leaderboard({ mostInstalled, mostStarred, className = '' }: LeaderboardProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<'installs' | 'stars'>('installs');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const installedRef = useRef<LeaderboardColumnHandle>(null);
  const starredRef = useRef<LeaderboardColumnHandle>(null);
  // Mobile 用单独的 ref
  const mobileInstalledRef = useRef<LeaderboardColumnHandle>(null);
  const mobileStarredRef = useRef<LeaderboardColumnHandle>(null);

  const colors = {
    installs: '#EA580C',
    stars: '#EAB308',
  };

  // mostInstalled 跳过了 headline，所以 offset = length + 1
  // mostStarred 从头开始，所以 offset = length
  const installedOffset = mostInstalled.length + 1;
  const starredOffset = mostStarred.length;

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);

    // 同时触发两个列表加载
    await Promise.all([
      installedRef.current?.loadMore(),
      starredRef.current?.loadMore(),
    ]);

    // 检查是否还有更多
    const stillHasMore = (installedRef.current?.hasMore ?? false) || (starredRef.current?.hasMore ?? false);
    setHasMore(stillHasMore);
    setLoading(false);
  };

  const loadMoreMobile = async () => {
    if (loading) return;
    setLoading(true);

    // 只加载当前 tab 的列表
    if (activeTab === 'installs') {
      await mobileInstalledRef.current?.loadMore();
      setHasMore(mobileInstalledRef.current?.hasMore ?? false);
    } else {
      await mobileStarredRef.current?.loadMore();
      setHasMore(mobileStarredRef.current?.hasMore ?? false);
    }
    setLoading(false);
  };

  return (
    <section className={`py-8 ${className}`}>
      {/* Section header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="section-label mb-1">{t('leaderboard.badge')}</p>
          <h2 className="text-2xl sm:text-3xl">{t('leaderboard.title')}</h2>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {t('leaderboard.updatedHourly')}
        </p>
      </div>

      {/* Desktop: Two columns side by side */}
      <div className="hidden md:block">
        <div className="grid gap-6 md:grid-cols-2">
          <LeaderboardColumn
            ref={installedRef}
            title={t('leaderboard.mostInstalled')}
            icon={Flame}
            initialSkills={mostInstalled}
            valueKey="installs"
            accentColor={colors.installs}
            sortBy="installs"
            initialOffset={installedOffset}
          />
          <LeaderboardColumn
            ref={starredRef}
            title={t('leaderboard.mostStarred')}
            icon={Star}
            initialSkills={mostStarred}
            valueKey="stars"
            accentColor={colors.stars}
            sortBy="stars"
            initialOffset={starredOffset}
          />
        </div>

        {/* Shared load more button */}
        {hasMore && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('leaderboard.loading')}
                </>
              ) : (
                t('leaderboard.loadMore')
              )}
            </button>
          </div>
        )}
      </div>

      {/* Mobile: Tab switching */}
      <div className="md:hidden">
        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setActiveTab('installs')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'installs'
                ? 'bg-foreground text-background'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            <Flame className="h-4 w-4" />
            {t('leaderboard.mostInstalled')}
          </button>
          <button
            onClick={() => setActiveTab('stars')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'stars'
                ? 'bg-foreground text-background'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            <Star className="h-4 w-4" />
            {t('leaderboard.mostStarred')}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'installs' ? (
          <LeaderboardColumn
            ref={mobileInstalledRef}
            title={t('leaderboard.mostInstalled')}
            icon={Flame}
            initialSkills={mostInstalled}
            valueKey="installs"
            accentColor={colors.installs}
            sortBy="installs"
            initialOffset={installedOffset}
          />
        ) : (
          <LeaderboardColumn
            ref={mobileStarredRef}
            title={t('leaderboard.mostStarred')}
            icon={Star}
            initialSkills={mostStarred}
            valueKey="stars"
            accentColor={colors.stars}
            sortBy="stars"
            initialOffset={starredOffset}
          />
        )}

        {/* Mobile load more button */}
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMoreMobile}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('leaderboard.loading')}
                </>
              ) : (
                t('leaderboard.loadMore')
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
