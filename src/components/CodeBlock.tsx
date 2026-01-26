'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

type CodeBlockProps = {
  code: string;
  label?: string;
  className?: string;
};

export function CodeBlock({ code, label, className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={className}>
      {label && (
        <p className="byline mb-2">{label}</p>
      )}
      <div className="group relative">
        <pre className="terminal">
          <span className="text-muted-foreground">$</span> {code}
          <span className="cursor" />
        </pre>
        <button
          onClick={handleCopy}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          style={{ color: 'var(--background)' }}
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
