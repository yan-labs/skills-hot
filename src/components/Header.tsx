'use client';

import { Github, User, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth } from './AuthProvider';
import { useState, useRef, useEffect } from 'react';

export function Header() {
  const t = useTranslations('header');
  const tAuth = useTranslations('auth');
  const { user, loading, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-semibold tracking-tight">
            SkillBank
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Link
            href="/skills"
            className="hidden rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block sm:px-3"
          >
            {t('browse')}
          </Link>
          <Link
            href="/docs"
            className="hidden rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block sm:px-3"
          >
            {t('docs')}
          </Link>
          <a
            href="https://github.com/yan-labs/skillbank"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:px-3"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">{t('github')}</span>
          </a>
          <div className="ml-1 flex items-center gap-1.5 sm:ml-2 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle />

            {/* Auth */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-md border border-border bg-background py-1 shadow-lg">
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-sm font-medium">{user.email}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      {tAuth('signOut')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {tAuth('signIn')}
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
