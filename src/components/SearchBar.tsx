'use client';

import { Search } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export function SearchBar() {
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
