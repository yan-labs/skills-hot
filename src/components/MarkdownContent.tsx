import { marked } from 'marked';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const html = marked.parse(content, { gfm: true, breaks: true }) as string;

  return (
    <div
      className={`prose prose-neutral dark:prose-invert max-w-none prose-pre:terminal prose-code:before:content-none prose-code:after:content-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
