'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Flame,
  ArrowUpRight
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
  rising: TrendingSkill[];      // 排名上升最多
  declining: TrendingSkill[];   // 排名下降最多
  newEntries: TrendingSkill[];  // 新晋榜单
  surging: TrendingSkill[];     // 安装量暴涨
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
  type: 'rising' | 'declining' | 'new' | 'surging';
  emptyText: string;
  accentColor: string;
}) {
  const getValueDisplay = (skill: TrendingSkill) => {
    switch (type) {
      case 'rising':
        // 计算上次排名: 当前排名 - 上升位次
        const prevRankRising = (skill.rank || 0) - (skill.rankDelta || 0);
        return (
          <span className="flex items-center gap-1 font-mono text-xs font-bold text-green-600 dark:text-green-400">
            <TrendingUp className="h-3 w-3" />
            {skill.rank}↑{skill.rankDelta}
            <span className="text-[10px] text-muted-foreground font-normal">
              ({prevRankRising})
            </span>
          </span>
        );
      case 'declining':
        // 计算上次排名: 当前排名 + 下降位次（rankDelta 是负数）
        const prevRankDeclining = (skill.rank || 0) - (skill.rankDelta || 0);
        return (
          <span className="flex items-center gap-1 font-mono text-xs font-bold text-[#C41E3A]">
            <TrendingDown className="h-3 w-3" />
            {skill.rank}↓{Math.abs(skill.rankDelta || 0)}
            <span className="text-[10px] text-muted-foreground font-normal">
              ({prevRankDeclining})
            </span>
          </span>
        );
      case 'new':
        return (
          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
            NEW
          </span>
        );
      case 'surging':
        return (
          <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400">
            {formatPercent(skill.installsRate || 0)}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col">
      {/* Column header */}
      <div
        className="mb-3 flex items-center gap-2 border-b-2 pb-2"
        style={{ borderColor: accentColor }}
      >
        <Icon className="h-4 w-4" style={{ color: accentColor }} />
        <h4
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          {title}
        </h4>
      </div>

      {/* Skills list */}
      <div className="flex-1 space-y-0 divide-y divide-border">
        {skills.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground italic">{emptyText}</p>
        ) : (
          skills.slice(0, 5).map((skill) => (
            <Link
              key={skill.slug}
              href={`/skills/${skill.slug}`}
              className="group flex items-center justify-between gap-2 py-2.5 transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium group-hover:underline">
                  {skill.name}
                </p>
                {skill.author && (
                  <p className="truncate text-xs text-muted-foreground">
                    {skill.author}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {getValueDisplay(skill)}
                <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

export function TrendingBoard({
  rising,
  declining,
  newEntries,
  surging,
  className = '',
}: TrendingBoardProps) {
  const t = useTranslations('trending');

  // 颜色定义
  const colors = {
    rising: '#16A34A',    // green-600
    declining: '#C41E3A', // accent red
    new: '#2563EB',       // blue-600
    surging: '#EA580C',   // orange-600
  };

  return (
    <section className={`py-8 ${className}`}>
      {/* Section header - 报纸风格 */}
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-4">
          <div className="h-px flex-1 bg-foreground" />
          <h3 className="font-serif text-sm font-medium uppercase tracking-[0.3em]">
            {t('title')}
          </h3>
          <div className="h-px flex-1 bg-foreground" />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Desktop: 4 columns */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-4">
        <TrendColumn
          title={t('rising')}
          icon={TrendingUp}
          skills={rising}
          type="rising"
          emptyText={t('noRising')}
          accentColor={colors.rising}
        />
        <TrendColumn
          title={t('declining')}
          icon={TrendingDown}
          skills={declining}
          type="declining"
          emptyText={t('noDeclining')}
          accentColor={colors.declining}
        />
        <TrendColumn
          title={t('new')}
          icon={Sparkles}
          skills={newEntries}
          type="new"
          emptyText={t('noNew')}
          accentColor={colors.new}
        />
        <TrendColumn
          title={t('surging')}
          icon={Flame}
          skills={surging}
          type="surging"
          emptyText={t('noSurging')}
          accentColor={colors.surging}
        />
      </div>

      {/* Tablet: 2+2 grid */}
      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:hidden">
        <TrendColumn
          title={t('rising')}
          icon={TrendingUp}
          skills={rising}
          type="rising"
          emptyText={t('noRising')}
          accentColor={colors.rising}
        />
        <TrendColumn
          title={t('declining')}
          icon={TrendingDown}
          skills={declining}
          type="declining"
          emptyText={t('noDeclining')}
          accentColor={colors.declining}
        />
        <TrendColumn
          title={t('new')}
          icon={Sparkles}
          skills={newEntries}
          type="new"
          emptyText={t('noNew')}
          accentColor={colors.new}
        />
        <TrendColumn
          title={t('surging')}
          icon={Flame}
          skills={surging}
          type="surging"
          emptyText={t('noSurging')}
          accentColor={colors.surging}
        />
      </div>

      {/* Mobile: Stacked accordion-like */}
      <div className="space-y-6 md:hidden">
        {/* Rising & Declining side by side */}
        <div className="grid grid-cols-2 gap-4">
          <TrendColumn
            title={t('rising')}
            icon={TrendingUp}
            skills={rising}
            type="rising"
            emptyText={t('noRising')}
            accentColor={colors.rising}
          />
          <TrendColumn
            title={t('declining')}
            icon={TrendingDown}
            skills={declining}
            type="declining"
            emptyText={t('noDeclining')}
            accentColor={colors.declining}
          />
        </div>

        {/* New & Surging side by side */}
        <div className="grid grid-cols-2 gap-4">
          <TrendColumn
            title={t('new')}
            icon={Sparkles}
            skills={newEntries}
            type="new"
            emptyText={t('noNew')}
            accentColor={colors.new}
          />
          <TrendColumn
            title={t('surging')}
            icon={Flame}
            skills={surging}
            type="surging"
            emptyText={t('noSurging')}
            accentColor={colors.surging}
          />
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground">
          {t('updateNote')}
        </p>
      </div>
    </section>
  );
}
