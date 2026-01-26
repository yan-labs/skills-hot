'use client';

import { Search } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

type SearchBarProps = {
  compact?: boolean;
};

export function SearchBar({ compact = false }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const t = useTranslations('search');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router]
  );

  if (compact) {
    return (
      <form onSubmit={handleSubmit}>
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="h-8 w-40 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:w-56 focus:border-foreground"
          />
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('placeholder')}
          className="h-10 w-full border-b border-border bg-transparent pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
        />
      </div>
    </form>
  );
}
