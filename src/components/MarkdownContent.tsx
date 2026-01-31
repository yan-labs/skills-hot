import { marked } from 'marked';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * 移除 YAML frontmatter（--- 之间的内容）
 * skills.sh 也是这样处理的 - frontmatter 用于元数据，不在正文显示
 */
function stripFrontmatter(content: string): string {
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
  return content.replace(frontmatterRegex, '').trim();
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  // 移除 frontmatter，只渲染正文内容
  const cleanContent = stripFrontmatter(content);
  const html = marked.parse(cleanContent, { gfm: true, breaks: true }) as string;

  return (
    <div
      className={`prose prose-neutral dark:prose-invert max-w-none prose-pre:terminal prose-code:before:content-none prose-code:after:content-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
