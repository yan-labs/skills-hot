'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  TrendingUp,
  Flame,
  Sparkles,
  ArrowUpRight,
  Download
} from 'lucide-react';

export type TrendingSkill = {
  name: string;
  slug: string;
  author?: string;
  installs: number;
  rank?: number;          // 当前排名
  rankDelta?: number;      // 排名变化（正=上升）
  installsDelta?: number;  // 安装量变化
  installsRate?: number;   // 安装量变化率
};

type TrendingBoardProps = {
  rising: TrendingSkill[];         // 排名上升最多
  fastestGrowing: TrendingSkill[]; // 24h 安装增量最多
  newEntries: TrendingSkill[];     // 新晋榜单
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

function formatPercent(rate: number): string {
  return `+${Math.round(rate * 100)}%`;
}

// 单个趋势列
function TrendColumn({
  title,
  icon: Icon,
  skills,
  type,
  emptyText,
  accentColor,
}: {
  title: string;
  icon: React.ElementType;
  skills: TrendingSkill[];
  type: 'rising' | 'fastestGrowing' | 'new';
  emptyText: string;
  accentColor: string;
}) {
  const getValueDisplay = (skill: TrendingSkill) => {
    // 当前排名显示（带 installs icon）
    const rankDisplay = skill.rank ? (
      <span className="flex items-center gap-0.5 font-mono text-xs text-muted-foreground">
        <Download className="h-3 w-3" />
        #{skill.rank}
      </span>
    ) : null;

    switch (type) {
      case 'rising':
        return (
          <span className="flex items-center gap-2">
            {rankDisplay}
            <span className="flex items-center gap-0.5 font-mono text-xs font-bold text-green-600 dark:text-green-400">
              <TrendingUp className="h-3 w-3" />
              +{skill.rankDelta}
            </span>
          </span>
        );
      case 'fastestGrowing':
        return (
          <span className="flex items-center gap-2">
            {rankDisplay}
            <span className="flex items-center gap-0.5 font-mono text-xs font-bold text-orange-600 dark:text-orange-400">
              <Download className="h-3 w-3" />
              +{skill.installsDelta}
            </span>
          </span>
        );
      case 'new':
        return (
          <span className="flex items-center gap-2">
            {rankDisplay}
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
              NEW
            </span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col rounded-lg bg-muted/30 p-4">
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: accentColor }} />
        </div>
        <h4
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          {title}
        </h4>
      </div>

      {/* Skills list */}
      <div className="flex-1 space-y-1">
        {skills.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground italic">{emptyText}</p>
        ) : (
          skills.slice(0, 5).map((skill) => {
            const avatarUrl = skill.author ? `https://github.com/${skill.author}.png?size=32` : null;

            return (
              <Link
                key={skill.slug}
                href={`/skills/${skill.slug}`}
                className="group flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-background/80"
              >
                {/* Avatar */}
                {avatarUrl && (
                  <img
                    src={avatarUrl}
                    alt={skill.author || ''}
                    className="h-6 w-6 rounded-full"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:underline">
                    {skill.name}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {getValueDisplay(skill)}
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

export function TrendingBoard({
  rising,
  fastestGrowing,
  newEntries,
  className = '',
}: TrendingBoardProps) {
  const t = useTranslations('trending');

  // 颜色定义
  const colors = {
    rising: '#16A34A',        // green-600
    fastestGrowing: '#EA580C', // orange-600
    new: '#2563EB',           // blue-600
  };

  return (
    <section className={`py-8 ${className}`}>
      {/* Section header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="section-label mb-1">{t('title')}</p>
          <h3 className="text-2xl sm:text-3xl">{t('subtitle')}</h3>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {t('rollingWindow')}
        </p>
      </div>

      {/* Desktop: 3 columns */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        <TrendColumn
          title={t('rising')}
          icon={TrendingUp}
          skills={rising}
          type="rising"
          emptyText={t('noRising')}
          accentColor={colors.rising}
        />
        <TrendColumn
          title={t('surging')}
          icon={Flame}
          skills={fastestGrowing}
          type="fastestGrowing"
          emptyText={t('noSurging')}
          accentColor={colors.fastestGrowing}
        />
        <TrendColumn
          title={t('new')}
          icon={Sparkles}
          skills={newEntries}
          type="new"
          emptyText={t('noNew')}
          accentColor={colors.new}
        />
      </div>

      {/* Tablet: 3 columns */}
      <div className="hidden gap-4 md:grid md:grid-cols-3 lg:hidden">
        <TrendColumn
          title={t('rising')}
          icon={TrendingUp}
          skills={rising}
          type="rising"
          emptyText={t('noRising')}
          accentColor={colors.rising}
        />
        <TrendColumn
          title={t('surging')}
          icon={Flame}
          skills={fastestGrowing}
          type="fastestGrowing"
          emptyText={t('noSurging')}
          accentColor={colors.fastestGrowing}
        />
        <TrendColumn
          title={t('new')}
          icon={Sparkles}
          skills={newEntries}
          type="new"
          emptyText={t('noNew')}
          accentColor={colors.new}
        />
      </div>

      {/* Mobile: Stacked */}
      <div className="space-y-4 md:hidden">
        <TrendColumn
          title={t('rising')}
          icon={TrendingUp}
          skills={rising}
          type="rising"
          emptyText={t('noRising')}
          accentColor={colors.rising}
        />
        <TrendColumn
          title={t('surging')}
          icon={Flame}
          skills={fastestGrowing}
          type="fastestGrowing"
          emptyText={t('noSurging')}
          accentColor={colors.fastestGrowing}
        />
        <TrendColumn
          title={t('new')}
          icon={Sparkles}
          skills={newEntries}
          type="new"
          emptyText={t('noNew')}
          accentColor={colors.new}
        />
      </div>

    </section>
  );
}
