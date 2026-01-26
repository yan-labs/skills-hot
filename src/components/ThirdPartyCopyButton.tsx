'use client';

import { useState, useCallback } from 'react';
import { Check, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface ThirdPartyCopyButtonProps {
  skillSlug: string;
  skillId: string;
  isPrivate?: boolean;
  className?: string;
}

/**
 * 第三方 CLI 安装命令复制按钮
 * 点击时自动生成短链接并复制
 */
export function ThirdPartyCopyButton({
  skillSlug,
  skillId,
  isPrivate = false,
  className = '',
}: ThirdPartyCopyButtonProps) {
  const t = useTranslations('skill.thirdParty');
  const [status, setStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [generatedUrl, setGeneratedUrl] = useState<string>('');

  const handleCopy = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      // 调用 API 生成短链接（无需 auth token，公开技能可匿名生成）
      const response = await fetch(`/api/skills/${skillSlug}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purpose: 'git_clone',
          expires_in: 3600, // 1 小时（第三方安装可能需要更长时间）
          max_uses: 10,
        }),
      });

      if (response.status === 401) {
        // 需要登录（私有技能）
        setStatus('error');
        setErrorMessage(t('loginRequired'));
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to generate link');
      }

      const data = await response.json();
      const installCommand = `npx skills add ${data.git_url.replace('https://', '')}`;

      // 复制到剪贴板
      await navigator.clipboard.writeText(installCommand);

      setGeneratedUrl(data.git_url);
      setStatus('copied');

      // 2 秒后恢复
      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Failed to generate share link:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate link');

      // 3 秒后恢复
      setTimeout(() => {
        setStatus('idle');
        setErrorMessage('');
      }, 3000);
    }
  }, [skillSlug, t]);

  const getTooltipContent = () => {
    if (status === 'error' && errorMessage) {
      return errorMessage;
    }
    if (status === 'copied') {
      return t('copied');
    }
    if (isPrivate) {
      return t('tooltipPrivate');
    }
    return t('tooltip');
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          disabled={status === 'loading'}
          className={cn(
            'group relative overflow-hidden transition-all duration-300',
            'hover:bg-gradient-to-r hover:from-emerald-500/10 hover:to-teal-500/10',
            'dark:hover:from-emerald-500/20 dark:hover:to-teal-500/20',
            status === 'copied' && 'bg-emerald-500/10 dark:bg-emerald-500/20',
            status === 'error' && 'bg-red-500/10 dark:bg-red-500/20',
            className
          )}
        >
          {/* Shimmer effect on hover */}
          <span
            className={cn(
              'absolute inset-0 -translate-x-full opacity-0',
              'bg-gradient-to-r from-transparent via-white/20 to-transparent',
              'group-hover:translate-x-full group-hover:opacity-100',
              'transition-all duration-700 ease-out',
              status === 'loading' && 'animate-pulse'
            )}
          />

          {/* Content */}
          <span className="relative flex items-center gap-1.5">
            {status === 'loading' ? (
              <>
                <Loader2 className="size-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {t('generating')}
                </span>
              </>
            ) : status === 'copied' ? (
              <>
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {t('copied')}
                </span>
              </>
            ) : status === 'error' ? (
              <>
                <AlertCircle className="size-3.5 text-red-500 dark:text-red-400" />
                <span className="text-xs font-medium text-red-500 dark:text-red-400">
                  {t('error')}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200" />
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-200">
                  {t('generate')}
                </span>
              </>
            )}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className={cn(
          'text-xs',
          status === 'error' && 'bg-red-500 text-white border-red-500'
        )}
      >
        <p>{getTooltipContent()}</p>
      </TooltipContent>
    </Tooltip>
  );
}
