"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowUpRight,
  TrendingUp,
  Star,
  Download,
  Check,
  Copy,
} from "lucide-react";
import Image from "next/image";

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
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

export function HeadlineSkill({ skill, author }: HeadlineSkillProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const installCommand = `npx skills add ${skill.name}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className=''>
      {/* Section header - 报纸风格横幅 */}
      <div className='mb-12 border-y-2 border-foreground py-2'>
        <p className='text-center font-serif text-sm font-medium uppercase tracking-[0.3em]'>
          {t("headline.badge")}
        </p>
      </div>

      {/* Unified Poster Card */}
      <Link href={`/skills/${skill.slug}`} className='group block'>
        <div className='relative'>
          {/* Top row: Growth number + Author */}
          <div className='flex items-start justify-between gap-6 mb-6'>
            {/* Left: Growth badge */}
            {skill.installs_delta && skill.installs_delta > 0 ? (
              <div className='flex items-start gap-4'>
                <div className='relative'>
                  <span className='font-serif text-[4.5rem] font-black leading-none tracking-tighter text-[#C41E3A] sm:text-[5.5rem] lg:text-[6.5rem]'>
                    +{formatNumber(skill.installs_delta)}
                  </span>
                  <div className='absolute -bottom-1 left-0 h-1 w-full bg-[#C41E3A]' />
                </div>
                <div className='mt-3 flex flex-col'>
                  <span className='text-xs font-bold uppercase tracking-[0.2em] text-[#C41E3A]'>
                    <TrendingUp className='inline h-3 w-3 mr-1' />
                    24H
                  </span>
                  <span className='mt-1 text-sm font-medium uppercase tracking-wider'>
                    {t("headline.fastestGrowing")}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <span className='text-xs font-bold uppercase tracking-[0.2em] text-[#C41E3A]'>
                  {t("headline.topSkill")}
                </span>
              </div>
            )}

            {/* Right: Author (integrated into poster) */}
            {author && (
              <div
                className='flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-lg transition-colors group-hover:bg-muted'
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/authors/${author.github_login}`;
                }}
              >
                {author.avatar_url ? (
                  <Image
                    src={author.avatar_url}
                    alt={author.name || author.github_login}
                    width={44}
                    height={44}
                    unoptimized
                    className='rounded-full ring-2 ring-background shadow-sm'
                  />
                ) : (
                  <div className='flex h-11 w-11 items-center justify-center rounded-full bg-foreground/10 text-sm font-semibold ring-2 ring-background'>
                    {(author.name || author.github_login)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div className='text-right'>
                  <p className='text-sm font-semibold hover:underline'>
                    {author.name || author.github_login}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {author.external_skill_count} {t("headline.skills")} ·{" "}
                    {formatNumber(author.total_installs)} installs
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Skill name - 报纸标题风格 */}
          <h2 className='font-serif text-3xl font-normal leading-tight sm:text-4xl md:text-5xl lg:text-[3.5rem] group-hover:underline decoration-1 underline-offset-4'>
            {skill.name}
          </h2>

          {/* Description */}
          {skill.description && (
            <p className='mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground'>
              {skill.description}
            </p>
          )}

          {/* Bottom row: Stats + Install command + CTA */}
          <div className='mt-8 flex flex-wrap items-end justify-between gap-6'>
            {/* Stats inline */}
            <div className='flex items-center gap-6 text-sm'>
              <div className='flex items-center gap-1.5'>
                <Download className='h-4 w-4 text-muted-foreground' />
                <span className='font-mono font-bold'>
                  {formatNumber(skill.installs)}
                </span>
                <span className='text-muted-foreground'>
                  {t("headline.installs")}
                </span>
              </div>
              {skill.stars !== undefined && skill.stars > 0 && (
                <div className='flex items-center gap-1.5'>
                  <Star className='h-4 w-4 text-muted-foreground' />
                  <span className='font-mono font-bold'>
                    {formatNumber(skill.stars)}
                  </span>
                  <span className='text-muted-foreground'>
                    {t("headline.stars")}
                  </span>
                </div>
              )}
              {skill.repo && (
                <span className='text-muted-foreground hidden sm:inline'>
                  {skill.repo}
                </span>
              )}
            </div>

            {/* Install command + CTA */}
            <div className='flex items-center gap-4'>
              {/* Quick install */}
              <button
                onClick={handleCopy}
                className='group/copy hidden sm:flex items-center gap-2 py-2 px-3 text-xs font-mono bg-neutral-900 text-neutral-100 rounded transition-all hover:bg-neutral-800'
              >
                <span className='text-neutral-500'>$</span>
                <span className='truncate max-w-[200px]'>{installCommand}</span>
                {copied ? (
                  <Check className='h-3.5 w-3.5 text-green-400 flex-shrink-0' />
                ) : (
                  <Copy className='h-3.5 w-3.5 text-neutral-500 group-hover/copy:text-neutral-300 flex-shrink-0' />
                )}
              </button>

              {/* CTA */}
              <div className='inline-flex items-center gap-2 border border-foreground px-4 py-2 transition-all group-hover:bg-foreground group-hover:text-background'>
                <span className='text-sm font-medium'>
                  {t("headline.viewSkill")}
                </span>
                <ArrowUpRight className='h-4 w-4' />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
