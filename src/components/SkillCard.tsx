'use client';

import { ArrowUpRight, Lock, Download } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { PlatformBadge } from '@/components/PlatformBadge';
import type { Platform } from '@/lib/supabase';
import Image from 'next/image';

type AuthorInfo = {
  github_login: string;
  name: string | null;
  avatar_url: string | null;
};

type SkillCardProps = {
  name: string;
  slug: string;
  description: string | null;
  author: string | null;
  category: string | null;
  tags: string[] | null;
  platforms?: Platform[] | null;
  installs: number;
  isPrivate?: boolean;
  source?: 'local' | 'skillsmp' | 'skills.sh';
  authorInfo?: AuthorInfo | null;
};

export function SkillCard({
  name,
  slug,
  description,
  author,
  platforms,
  installs,
  isPrivate,
  source,
  authorInfo,
}: SkillCardProps) {
  const t = useTranslations();

  // Generate avatar URL from GitHub username if no authorInfo
  const avatarUrl = authorInfo?.avatar_url || (author ? `https://github.com/${author}.png?size=64` : null);
  const displayName = authorInfo?.name || author;

  return (
    <Link
      href={`/skills/${slug}`}
      className="group flex gap-4 py-4 transition-colors"
    >
      {/* Author avatar */}
      {avatarUrl && (
        <div className="flex-shrink-0">
          <Image
            src={avatarUrl}
            alt={displayName || 'Author'}
            width={40}
            height={40}
            unoptimized
            className="rounded-full grayscale transition-all group-hover:grayscale-0"
          />
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-medium leading-tight group-hover:underline">
                {name}
              </h3>
              {isPrivate && (
                <Lock className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              )}
              {source === 'skills.sh' && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                  Featured
                </span>
              )}
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        {/* Description */}
        {description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}

        {/* Bottom row: Platforms + Meta */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Platforms - only show if NOT universal-only */}
          {platforms && platforms.length > 0 && !(platforms.length === 1 && platforms[0] === 'universal') && (
            <PlatformBadge platforms={platforms} showLabel={false} />
          )}

          {/* Author + Installs */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {displayName && <span>{displayName}</span>}
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {installs.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
