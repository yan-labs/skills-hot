'use client';

import { Github, User, LogOut, UserCircle } from 'lucide-react';
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
    <header className="sticky top-0 z-50 w-full bg-background">
      {/* Top line - like newspaper masthead */}
      <div className="border-b border-border">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Logo - editorial style */}
          <Link href="/" className="group">
            <span className="text-xl font-bold tracking-tight sm:text-2xl">
              Skills Hot
            </span>
          </Link>

          {/* Right side utilities */}
          <div className="flex items-center gap-3 sm:gap-4">
            <LanguageSwitcher />
            <ThemeToggle />

            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  <User className="h-4 w-4" />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-48 border border-border bg-background py-1 shadow-sm">
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-sm">{user.email}</p>
                    </div>
                    {user.user_metadata?.user_name && (
                      <Link
                        href={`/authors/${user.user_metadata.user_name}`}
                        onClick={() => setShowDropdown(false)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <UserCircle className="h-4 w-4" />
                        {tAuth('myProfile')}
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {tAuth('signIn')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Navigation - simple text links */}
      <nav className="border-b border-border">
        <div className="mx-auto flex h-10 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link
            href="/authors"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('authors')}
          </Link>
          <Link
            href="/docs"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('docs')}
          </Link>
          <a
            href="https://github.com/yan-labs/skills-hot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('github')}</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
