'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { trackCopy } from '@/lib/analytics';
import { Button } from '@/components/ui/button';

type CopyButtonProps = {
  text: string;
  className?: string;
  skillSlug?: string;
};

export function CopyButton({ text, className = '', skillSlug }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations('skill');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    if (skillSlug) {
      trackCopy(skillSlug);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={className}
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-green-400" />
          <span className="text-xs">{t('copied')}</span>
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          <span className="text-xs">{t('copy')}</span>
        </>
      )}
    </Button>
  );
}
