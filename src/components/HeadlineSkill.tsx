'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, TrendingUp, Star, Download } from 'lucide-react';
import Image from 'next/image';

type Author = {
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  external_skill_count: number;
  total_installs: number;
};

type HeadlineSkillProps = {
  skill: {
    name: string;
    slug: string;
    description: string | null;
    installs: number;
    stars?: number;
    repo?: string;
    installs_delta?: number; // 24小时增长量
  };
  author: Author | null;
};

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function HeadlineSkill({ skill, author }: HeadlineSkillProps) {
  const t = useTranslations();

  return (
    <section className="py-8 sm:py-12">
      {/* Section header - 报纸风格横幅 */}
      <div className="mb-8 border-y-2 border-foreground py-2">
        <p className="text-center font-serif text-sm font-medium uppercase tracking-[0.3em]">
          {t('headline.badge')}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_220px] lg:gap-10">
        {/* Left: Headline Skill */}
        <div className="order-1">
          <Link
            href={`/skills/${skill.slug}`}
            className="group block"
          >
            {/* Growth badge - 红色醒目数字 */}
            {skill.installs_delta && skill.installs_delta > 0 ? (
              <div className="mb-4 flex items-start gap-4">
                <div className="relative">
                  <span
                    className="font-serif text-[5rem] font-black leading-none tracking-tighter text-[#C41E3A] sm:text-[6rem] lg:text-[7rem]"
                  >
                    +{formatNumber(skill.installs_delta)}
                  </span>
                  {/* 装饰性下划线 */}
                  <div className="absolute -bottom-1 left-0 h-1 w-full bg-[#C41E3A]" />
                </div>
                <div className="mt-4 flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C41E3A]">
                    <TrendingUp className="inline h-3 w-3 mr-1" />
                    24H
                  </span>
                  <span className="mt-1 text-sm font-medium uppercase tracking-wider">
                    {t('headline.fastestGrowing')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C41E3A]">
                  {t('headline.topSkill')}
                </span>
              </div>
            )}

            {/* Skill name - 报纸标题风格 */}
            <h2 className="font-serif text-3xl font-normal leading-tight sm:text-4xl md:text-5xl lg:text-[3.5rem] group-hover:underline decoration-1 underline-offset-4">
              {skill.name}
            </h2>

            {/* Description - 副标题 */}
            {skill.description && (
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                {skill.description}
              </p>
            )}

            {/* Repo info */}
            {skill.repo && (
              <p className="byline mt-3">
                {skill.repo}
              </p>
            )}

            {/* CTA */}
            <div className="mt-6 inline-flex items-center gap-2 border border-foreground px-4 py-2 transition-all group-hover:bg-foreground group-hover:text-background">
              <span className="text-sm font-medium">{t('headline.viewSkill')}</span>
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </Link>
        </div>

        {/* Right Sidebar: Stats + Author */}
        <div className="order-2">
          {/* Stats Card */}
          <div className="border-t border-border pt-4">
            <p className="section-label mb-4">{t('headline.statistics')}</p>

            <div className="space-y-3">
              {/* Installs */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Download className="h-4 w-4" />
                  <span className="text-xs">{t('headline.installs')}</span>
                </div>
                <span className="font-mono text-base font-bold">{formatNumber(skill.installs)}</span>
              </div>

              {/* Stars */}
              {skill.stars !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Star className="h-4 w-4" />
                    <span className="text-xs">{t('headline.stars')}</span>
                  </div>
                  <span className="font-mono text-base font-bold">{formatNumber(skill.stars)}</span>
                </div>
              )}

              {/* 24h Growth */}
              {skill.installs_delta !== undefined && skill.installs_delta > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">{t('headline.growth24h')}</span>
                  </div>
                  <span className="font-mono text-base font-bold text-[#C41E3A]">
                    +{formatNumber(skill.installs_delta)}
                  </span>
                </div>
              )}
            </div>

            {/* Quick install hint */}
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {t('headline.installHint')}
              </p>
              <code className="mt-2 block truncate bg-foreground px-2 py-1.5 text-xs text-background">
                npx skills add {skill.name}
              </code>
            </div>
          </div>

          {/* Author Card */}
          {author ? (
            <Link
              href={`/authors/${author.github_login}`}
              className="group mt-6 block border-t border-border pt-4"
            >
              <p className="section-label mb-3">Author</p>
              <div className="flex items-center gap-3">
                {author.avatar_url ? (
                  <Image
                    src={author.avatar_url}
                    alt={author.name || author.github_login}
                    width={40}
                    height={40}
                    unoptimized
                    className="rounded-full grayscale transition-all group-hover:grayscale-0"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {(author.name || author.github_login).charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium group-hover:underline">
                    {author.name || author.github_login}
                  </p>
                  <p className="text-xs text-muted-foreground">@{author.github_login}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>{author.external_skill_count} {t('headline.skills')}</span>
                <span>{formatNumber(author.total_installs)} {t('headline.totalInstalls')}</span>
              </div>
            </Link>
          ) : (
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">{t('headline.unknownAuthor')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
