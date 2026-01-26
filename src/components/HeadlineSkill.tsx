'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Trophy, TrendingUp, Star, Download } from 'lucide-react';
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
      {/* Section header */}
      <div className="mb-6 flex items-center gap-3">
        <Trophy className="h-5 w-5 text-accent" />
        <span className="section-label text-accent">{t('headline.badge')}</span>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr_200px] lg:gap-8">
        {/* Left: Author Card */}
        <div className="order-2 lg:order-1">
          {author ? (
            <Link
              href={`/authors/${author.github_login}`}
              className="group block rounded-none border border-border bg-card p-4 transition-colors hover:border-foreground"
            >
              <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-4">
                {author.avatar_url ? (
                  <Image
                    src={author.avatar_url}
                    alt={author.name || author.github_login}
                    width={48}
                    height={48}
                    unoptimized
                    className="rounded-full grayscale transition-all group-hover:grayscale-0 lg:h-16 lg:w-16"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-medium lg:h-16 lg:w-16">
                    {(author.name || author.github_login).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 lg:w-full">
                  <p className="font-medium group-hover:underline">
                    {author.name || author.github_login}
                  </p>
                  <p className="text-sm text-muted-foreground">@{author.github_login}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground lg:flex-col lg:gap-2">
                <span>{author.external_skill_count} {t('headline.skills')}</span>
                <span>{formatNumber(author.total_installs)} {t('headline.totalInstalls')}</span>
              </div>
            </Link>
          ) : (
            <div className="rounded-none border border-border bg-card p-4">
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
            {/* Rank - dramatic oversized outline number */}
            <div className="mb-2 flex items-end gap-4">
              <span
                className="font-serif text-[5rem] font-bold leading-none tracking-tighter sm:text-[6rem] lg:text-[8rem]"
                style={{
                  WebkitTextStroke: '2px currentColor',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {rank}
              </span>
              <div className="mb-3 flex flex-col gap-1">
                <span className="section-label text-accent">{t('headline.badge')}</span>
                <span className="text-sm font-medium uppercase tracking-wider">{t('headline.mostInstalled')}</span>
              </div>
            </div>

            {/* Skill name - huge */}
            <h2 className="text-3xl leading-tight sm:text-4xl md:text-5xl lg:text-6xl group-hover:underline decoration-2 underline-offset-4">
              {skill.name}
            </h2>

            {/* Description */}
            {skill.description && (
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl">
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
            <div className="mt-6 inline-flex items-center gap-2 bg-foreground px-4 py-2 text-background transition-transform group-hover:translate-x-1">
              <span className="text-sm font-medium">{t('headline.viewSkill')}</span>
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </Link>
        </div>

        {/* Right: Stats Card */}
        <div className="order-3">
          <div className="rounded-none border border-border bg-card p-4">
            <p className="section-label mb-4">{t('headline.statistics')}</p>

            <div className="space-y-4">
              {/* Installs */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Download className="h-4 w-4" />
                  <span className="text-sm">{t('headline.installs')}</span>
                </div>
                <span className="font-mono text-lg font-bold">{formatNumber(skill.installs)}</span>
              </div>

              {/* Stars */}
              {skill.stars !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Star className="h-4 w-4" />
                    <span className="text-sm">{t('headline.stars')}</span>
                  </div>
                  <span className="font-mono text-lg font-bold">{formatNumber(skill.stars)}</span>
                </div>
              )}

              {/* Growth */}
              {growthPercent !== undefined && growthPercent > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">{t('headline.growth')}</span>
                  </div>
                  <span className="font-mono text-lg font-bold text-accent">
                    +{growthPercent}%
                  </span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="divider my-4" />

            {/* Quick install hint */}
            <p className="text-xs text-muted-foreground">
              {t('headline.installHint')}
            </p>
            <code className="mt-2 block truncate bg-muted px-2 py-1 text-xs">
              npx skills add {skill.name}
            </code>
          </div>
        </div>
      </div>
    </section>
  );
}
