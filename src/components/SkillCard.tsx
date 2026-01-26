'use client';

import { ArrowUpRight, Lock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

type SkillCardProps = {
  name: string;
  slug: string;
  description: string | null;
  author: string | null;
  category: string | null;
  tags: string[] | null;
  installs: number;
  isPrivate?: boolean;
  source?: 'local' | 'skillsmp' | 'skills.sh';
};

export function SkillCard({
  name,
  slug,
  description,
  author,
  installs,
  isPrivate,
  source,
}: SkillCardProps) {
  const t = useTranslations();

  return (
    <Link
      href={`/skills/${slug}`}
      className="group block py-4 transition-colors"
    >
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

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        {author && <span>{author}</span>}
        <span>{installs.toLocaleString()} installs</span>
        {source === 'skills.sh' && (
          <span className="text-accent">Featured</span>
        )}
      </div>
    </Link>
  );
}
