'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Header } from '@/components/Header';
import { ArrowLeft, Mail, Lock, Github, CheckCircle } from 'lucide-react';

export default function SignUpPage() {
  const t = useTranslations('auth');
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  const handleGitHubSignUp = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background">
        <Header />

        <main className="mx-auto max-w-sm px-4 py-12 sm:px-6 sm:py-16">
          <div className="text-center">
            <CheckCircle className="mx-auto mb-6 h-12 w-12 text-green-600" />
            <h1 className="text-3xl">{t('checkEmail')}</h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">{t('checkEmailDesc')}</p>
            <Link
              href="/auth/signin"
              className="mt-8 inline-block text-sm text-foreground underline underline-offset-2"
            >
              {t('backToSignIn')}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-sm px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </Link>

        <div className="mt-8">
          <p className="section-label mb-2">Account</p>
          <h1 className="text-3xl">{t('signUp')}</h1>

          {error && (
            <div className="mt-6 border-l-2 border-destructive bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="mt-8 space-y-6">
            <div>
              <label htmlFor="email" className="byline mb-2 block">
                {t('email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-b border-border bg-transparent py-2 pl-6 text-sm transition-colors focus:border-foreground focus:outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="byline mb-2 block">
                {t('password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-b border-border bg-transparent py-2 pl-6 text-sm transition-colors focus:border-foreground focus:outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="byline mb-2 block">
                {t('confirmPassword')}
              </label>
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border-b border-border bg-transparent py-2 pl-6 text-sm transition-colors focus:border-foreground focus:outline-none"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-foreground bg-foreground py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? t('signingUp') : t('signUp')}
            </button>
          </form>

          <div className="my-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t('orContinueWith')}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={handleGitHubSignUp}
            className="flex w-full items-center justify-center gap-2 border border-border py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Github className="h-4 w-4" />
            GitHub
          </button>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t('hasAccount')}{' '}
            <Link href="/auth/signin" className="text-foreground underline underline-offset-2">
              {t('signIn')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
