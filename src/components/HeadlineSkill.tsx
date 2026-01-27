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
  };
  author: Author | null;
  rank: number;
  growthPercent?: number;
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

export function HeadlineSkill({ skill, author, rank, growthPercent }: HeadlineSkillProps) {
  const t = useTranslations();

  return (
    <section className="py-8 sm:py-12">
      {/* Section header - 报纸风格横幅 */}
      <div className="mb-8 border-y-2 border-foreground py-2">
        <p className="text-center font-serif text-sm font-medium uppercase tracking-[0.3em]">
          {t('headline.badge')}
        </p>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[180px_1fr_200px] lg:gap-10">
        {/* Left: Author Card */}
        <div className="order-3 lg:order-1">
          {author ? (
            <Link
              href={`/authors/${author.github_login}`}
              className="group block border-t border-border pt-4"
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
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>{author.external_skill_count} {t('headline.skills')}</p>
                <p>{formatNumber(author.total_installs)} {t('headline.totalInstalls')}</p>
              </div>
            </Link>
          ) : (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">{t('headline.unknownAuthor')}</p>
            </div>
          )}
        </div>

        {/* Center: Headline Skill */}
        <div className="order-1 lg:order-2">
          <Link
            href={`/skills/${skill.slug}`}
            className="group block"
          >
            {/* Rank badge - 红色醒目数字 */}
            <div className="mb-4 flex items-start gap-4">
              <div className="relative">
                <span
                  className="font-serif text-[6rem] font-black leading-none tracking-tighter text-[#C41E3A] sm:text-[7rem] lg:text-[9rem]"
                >
                  {rank}
                </span>
                {/* 装饰性下划线 */}
                <div className="absolute -bottom-1 left-0 h-1 w-full bg-[#C41E3A]" />
              </div>
              <div className="mt-4 flex flex-col">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C41E3A]">
                  No.{rank}
                </span>
                <span className="mt-1 text-sm font-medium uppercase tracking-wider">
                  {t('headline.mostInstalled')}
                </span>
              </div>
            </div>

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

        {/* Right: Stats Card */}
        <div className="order-2 lg:order-3">
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

              {/* Growth */}
              {growthPercent !== undefined && growthPercent > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">{t('headline.growth')}</span>
                  </div>
                  <span className="font-mono text-base font-bold text-[#C41E3A]">
                    +{growthPercent}%
                  </span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="my-4 border-t border-border" />

            {/* Quick install hint */}
            <p className="text-xs text-muted-foreground">
              {t('headline.installHint')}
            </p>
            <code className="mt-2 block truncate bg-foreground px-2 py-1.5 text-xs text-background">
              npx skills add {skill.name}
            </code>
          </div>
        </div>
      </div>
    </section>
  );
}
