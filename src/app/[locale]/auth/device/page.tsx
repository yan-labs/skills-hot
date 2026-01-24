'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Header } from '@/components/Header';
import { ArrowLeft, Terminal, CheckCircle, XCircle, Loader2 } from 'lucide-react';

type AuthStatus = 'input' | 'confirming' | 'success' | 'error' | 'not_logged_in';

export default function DeviceAuthPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [userCode, setUserCode] = useState('');
  const [status, setStatus] = useState<AuthStatus>('input');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<{ device_name?: string } | null>(null);

  // 检查用户登录状态
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
      } else {
        setStatus('not_logged_in');
      }
    };
    checkUser();

    // 从 URL 获取预填的 code
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      setUserCode(codeFromUrl.toUpperCase());
    }
  }, [supabase, searchParams]);

  // 格式化用户输入的 code（自动添加破折号）
  const formatUserCode = (value: string) => {
    // 移除非字母数字字符
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // 在第4个字符后添加破折号
    if (cleaned.length > 4) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
    }
    return cleaned;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatUserCode(e.target.value);
    setUserCode(formatted);
  };

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('confirming');
    setError(null);

    try {
      // 验证 user_code 并获取设备信息
      const response = await fetch('/api/auth/device/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: userCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authorization failed');
        setStatus('error');
        return;
      }

      setDeviceInfo(data.client_info);
      setStatus('success');
    } catch (err) {
      setError('Network error. Please try again.');
      setStatus('error');
    }
  };

  const handleSignIn = () => {
    // 保存当前页面 URL 以便登录后返回
    const returnUrl = `/auth/device${userCode ? `?code=${userCode}` : ''}`;
    router.push(`/auth/signin?next=${encodeURIComponent(returnUrl)}`);
  };

  // 未登录状态
  if (status === 'not_logged_in') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="rounded-lg border border-border p-6 sm:p-8 text-center">
            <Terminal className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="mb-2 text-2xl font-semibold">Authorize CLI</h1>
            <p className="mb-6 text-muted-foreground">
              Please sign in to authorize your CLI application.
            </p>
            <button
              onClick={handleSignIn}
              className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign In to Continue
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 授权成功状态
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
          <div className="rounded-lg border border-border p-6 sm:p-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h1 className="mb-2 text-2xl font-semibold">Authorization Complete</h1>
            <p className="mb-4 text-muted-foreground">
              Your CLI has been authorized successfully.
            </p>
            {deviceInfo?.device_name && (
              <p className="text-sm text-muted-foreground mb-6">
                Device: {deviceInfo.device_name}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              You can close this window and return to your terminal.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // 错误状态
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="rounded-lg border border-border p-6 sm:p-8 text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h1 className="mb-2 text-2xl font-semibold">Authorization Failed</h1>
            <p className="mb-6 text-destructive">{error}</p>
            <button
              onClick={() => {
                setStatus('input');
                setError(null);
                setUserCode('');
              }}
              className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 输入/确认状态
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="rounded-lg border border-border p-6 sm:p-8">
          <div className="mb-6 text-center">
            <Terminal className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h1 className="mb-2 text-2xl font-semibold">Authorize CLI</h1>
            <p className="text-muted-foreground">
              Enter the code displayed in your terminal to authorize the SkillBank CLI.
            </p>
          </div>

          {user && (
            <div className="mb-6 rounded-md bg-muted p-3 text-center text-sm">
              Authorizing as <span className="font-medium">{user.email}</span>
            </div>
          )}

          <form onSubmit={handleAuthorize}>
            <div className="mb-6">
              <label htmlFor="code" className="mb-2 block text-sm font-medium text-center">
                Device Code
              </label>
              <input
                id="code"
                type="text"
                value={userCode}
                onChange={handleCodeChange}
                className="w-full rounded-md border border-border bg-background py-3 px-4 text-center text-2xl font-mono tracking-wider transition-colors focus:border-primary focus:outline-none"
                placeholder="XXXX-XXXX"
                maxLength={9}
                required
                autoFocus
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'confirming' || userCode.length < 9}
              className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === 'confirming' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authorizing...
                </>
              ) : (
                'Authorize'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Make sure this code matches exactly what you see in your terminal.
            <br />
            If you didn&apos;t request this, please close this page.
          </p>
        </div>
      </main>
    </div>
  );
}
