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
  const { user, signOut } = useAuth();
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
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center bg-foreground text-background">
              <span className="font-serif text-lg font-bold">S</span>
            </div>
            <span className="hidden font-serif text-xl tracking-tight sm:inline">
              Skills Hot
            </span>
          </Link>

          {/* Nav links - inline with logo */}
          <nav className="hidden items-center gap-5 md:flex">
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
            </a>
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <ThemeToggle />

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              >
                <User className="h-4 w-4" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-background py-1 shadow-lg ring-1 ring-border/50">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">{user.email}</p>
                  </div>
                  <div className="h-px bg-border/50" />
                  {user.user_metadata?.user_name && (
                    <Link
                      href={`/authors/${user.user_metadata.user_name}`}
                      onClick={() => setShowDropdown(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    >
                      <UserCircle className="h-4 w-4" />
                      {tAuth('myProfile')}
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
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
              className="rounded-full bg-foreground px-4 py-1.5 text-sm text-background transition-opacity hover:opacity-90"
            >
              {tAuth('signIn')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
