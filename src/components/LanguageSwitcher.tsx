'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const currentLanguage = languages.find((lang) => lang.code === locale);

  return (
    <div className="relative">
      <button
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-sm transition-colors hover:bg-muted sm:w-auto sm:gap-1.5 sm:px-2.5"
        onClick={() => {
          const nextLocale = locale === 'en' ? 'zh' : 'en';
          handleChange(nextLocale);
        }}
        aria-label="Switch language"
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="hidden text-muted-foreground sm:inline">{currentLanguage?.label}</span>
      </button>
    </div>
  );
}
