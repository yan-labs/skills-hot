'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { X } from 'lucide-react';

const LANGUAGE_PREF_KEY = 'skills-hot-lang-pref';
const LANGUAGE_DISMISSED_KEY = 'skills-hot-lang-dismissed';

const languageNames: Record<string, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  zh: { native: '中文', english: 'Chinese' },
};

// Map browser language codes to our supported locales
function getBrowserLocale(): string | null {
  if (typeof navigator === 'undefined') return null;

  const browserLang = navigator.language || (navigator as { userLanguage?: string }).userLanguage;
  if (!browserLang) return null;

  // Extract primary language code (e.g., 'zh-CN' -> 'zh', 'en-US' -> 'en')
  const primaryLang = browserLang.split('-')[0].toLowerCase();

  // Map to our supported locales
  if (primaryLang === 'zh') return 'zh';
  if (primaryLang === 'en') return 'en';

  // Default to null if not supported
  return null;
}

export function LanguageSuggestion() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('languageSuggestion');

  const [suggestedLocale, setSuggestedLocale] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already set a preference or dismissed the suggestion
    const savedPref = localStorage.getItem(LANGUAGE_PREF_KEY);
    const dismissed = sessionStorage.getItem(LANGUAGE_DISMISSED_KEY);

    if (savedPref || dismissed) {
      return;
    }

    // Detect browser language
    const browserLocale = getBrowserLocale();

    // Show suggestion if browser language differs from current page language
    if (browserLocale && browserLocale !== locale) {
      setSuggestedLocale(browserLocale);
      setIsVisible(true);
    }
  }, [locale]);

  const handleSwitch = () => {
    if (!suggestedLocale) return;

    // Save preference to localStorage
    localStorage.setItem(LANGUAGE_PREF_KEY, suggestedLocale);

    // Navigate to the suggested locale
    router.replace(pathname, { locale: suggestedLocale });
    setIsVisible(false);
  };

  const handleDismiss = () => {
    // Only dismiss for this session, don't save permanent preference
    sessionStorage.setItem(LANGUAGE_DISMISSED_KEY, 'true');
    setIsVisible(false);
  };

  const handleStay = () => {
    // Save current locale as preference
    localStorage.setItem(LANGUAGE_PREF_KEY, locale);
    setIsVisible(false);
  };

  if (!isVisible || !suggestedLocale) {
    return null;
  }

  const suggestedLangName = languageNames[suggestedLocale];

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="rounded-lg border border-border bg-background p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">
              {t('detected', { language: suggestedLangName.native })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('suggestion')}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSwitch}
            className="flex-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t('switch', { language: suggestedLangName.native })}
          </button>
          <button
            onClick={handleStay}
            className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t('stay')}
          </button>
        </div>
      </div>
    </div>
  );
}
