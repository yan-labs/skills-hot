'use client';

import { Download, ArrowUpRight, Lock } from 'lucide-react';
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
  source?: 'local' | 'skillsmp';
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
      className="group block rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{name}</h3>
          {isPrivate && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
              <Lock className="h-3 w-3" />
              {t('common.private')}
            </span>
          )}
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
        {description || 'No description available'}
      </p>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            <span>{installs.toLocaleString()}</span>
          </div>
          {source === 'skillsmp' && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">SkillSMP</span>
          )}
        </div>
        {author && (
          <span>
            {t('common.by')} {author}
          </span>
        )}
      </div>
    </Link>
  );
}
