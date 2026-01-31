'use client';

import { User, LogOut, UserCircle, Terminal, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SearchBar } from './SearchBar';
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
      <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Name + Nav */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link href="/" className="font-serif text-xl tracking-tight hover:opacity-80 transition-opacity">
            Skills Hot
          </Link>

          {/* Nav links */}
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/search"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Terminal className="h-3.5 w-3.5" />
              {t('browse')}
            </Link>
            <Link
              href="/authors"
              className="px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t('authors')}
            </Link>
          </nav>
        </div>

        {/* Right: Search + Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden sm:block">
            <SearchBar compact />
          </div>
          <LanguageSwitcher />
          <ThemeToggle />

          <div className="mx-1 h-4 w-px bg-border/50" />

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex h-9 items-center gap-1.5 px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <User className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-56 border border-border bg-background py-1 shadow-lg">
                  <div className="border-b border-border px-3 py-2">
                    <p className="truncate text-sm font-medium">{user.email}</p>
                  </div>
                  {user.user_metadata?.user_name && (
                    <Link
                      href={`/authors/${user.user_metadata.user_name}`}
                      onClick={() => setShowDropdown(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <UserCircle className="h-4 w-4" />
                      {tAuth('myProfile')}
                    </Link>
                  )}
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
              className="bg-foreground px-3 py-1.5 text-sm text-background transition-opacity hover:opacity-90"
            >
              {tAuth('signIn')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
