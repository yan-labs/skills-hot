'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Copy, Clock, AlertCircle, Share2, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShareLink {
  short_url: string;
  git_url: string;
  tarball_url: string;
  clone_command: string;
  npx_command: string;
  expires_at: string;
  max_uses: number;
  skill: {
    slug: string;
    name: string;
  };
}

interface ShareLinkDialogProps {
  skillSlug: string;
  skillName: string;
  isOpen: boolean;
  onClose: () => void;
  authToken?: string;
}

export function ShareLinkDialog({
  skillSlug,
  skillName,
  isOpen,
  onClose,
  authToken,
}: ShareLinkDialogProps) {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // 计算剩余时间
  useEffect(() => {
    if (!link) return;

    const updateTime = () => {
      const expiry = new Date(link.expires_at);
      const diff = expiry.getTime() - Date.now();

      if (diff <= 0) {
        setTimeRemaining('expired');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [link]);

  const generateLink = useCallback(async () => {
    if (!authToken) {
      setError('Please login to generate share links');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/skills/${skillSlug}/share`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purpose: 'git_clone',
          expires_in: 600, // 10 分钟
          max_uses: 5,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to generate link');
      }

      const data = await response.json();
      setLink(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link');
    } finally {
      setLoading(false);
    }
  }, [skillSlug, authToken]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  // 打开时自动生成链接
  useEffect(() => {
    if (isOpen && !link && authToken) {
      generateLink();
    }
  }, [isOpen, link, authToken, generateLink]);

  // 关闭时重置状态
  useEffect(() => {
    if (!isOpen) {
      setLink(null);
      setError(null);
      setCopiedField(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Share2 className="size-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Generate Download Link</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Skill info */}
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            Skill: <span className="font-medium text-zinc-900 dark:text-zinc-100">{skillName}</span>
          </div>

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="size-6 animate-spin text-blue-500" />
              <span className="ml-2 text-zinc-500">Generating link...</span>
            </div>
          )}

          {/* Link generated */}
          {link && !loading && (
            <div className="space-y-4">
              {/* Git Clone Command */}
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Git Clone
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg font-mono truncate">
                    {link.clone_command}
                  </code>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => copyToClipboard(link.clone_command, 'clone')}
                  >
                    {copiedField === 'clone' ? (
                      <Check className="size-4 text-green-500" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* NPX Command (for skills.sh) */}
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  skills.sh / openskills
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg font-mono truncate">
                    {link.npx_command}
                  </code>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => copyToClipboard(link.npx_command, 'npx')}
                  >
                    {copiedField === 'npx' ? (
                      <Check className="size-4 text-green-500" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Git URL */}
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Git URL
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg font-mono truncate">
                    {link.git_url}
                  </code>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => copyToClipboard(link.git_url, 'git')}
                  >
                    {copiedField === 'git' ? (
                      <Check className="size-4 text-green-500" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Tarball URL */}
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tarball
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg font-mono truncate">
                    {link.tarball_url}
                  </code>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => copyToClipboard(link.tarball_url, 'tarball')}
                  >
                    {copiedField === 'tarball' ? (
                      <Check className="size-4 text-green-500" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Expiry Info */}
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <Clock className="size-4" />
                <span>
                  Expires in{' '}
                  <span
                    className={
                      timeRemaining === 'expired'
                        ? 'text-red-500 font-medium'
                        : 'font-medium text-zinc-700 dark:text-zinc-300'
                    }
                  >
                    {timeRemaining}
                  </span>{' '}
                  ({link.max_uses} uses max)
                </span>
              </div>

              {/* Security Notice */}
              <div className="p-3 text-sm bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Security Notice
                </p>
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  This link provides temporary access to download this skill. Do not share it
                  publicly.
                </p>
              </div>
            </div>
          )}

          {/* No auth token */}
          {!authToken && !loading && (
            <div className="py-8 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                Please login to generate download links.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          {link && (
            <Button variant="outline" onClick={generateLink} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              Generate New
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 触发按钮组件
 */
export function ShareLinkButton({
  skillSlug,
  skillName,
  authToken,
  className = '',
}: {
  skillSlug: string;
  skillName: string;
  authToken?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <Share2 className="size-4" />
        Share Link
      </Button>

      <ShareLinkDialog
        skillSlug={skillSlug}
        skillName={skillName}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        authToken={authToken}
      />
    </>
  );
}
