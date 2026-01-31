'use client';

import { FileText, Folder, FileCode, File, Github } from 'lucide-react';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
}

interface SkillFilesProps {
  files: FileItem[];
  githubUrl?: string | null;
}

function getFileIcon(name: string, type: string) {
  if (type === 'dir') {
    return <Folder className="h-4 w-4 text-blue-400" />;
  }

  const ext = name.split('.').pop()?.toLowerCase();

  if (ext === 'md') {
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'sh'].includes(ext || '')) {
    return <FileCode className="h-4 w-4 text-green-400" />;
  }

  return <File className="h-4 w-4 text-muted-foreground" />;
}

export function SkillFiles({ files, githubUrl }: SkillFilesProps) {
  if (!files || files.length === 0) {
    return null;
  }

  // 排序：目录在前，文件在后，然后按名称排序
  // SKILL.md 始终在最前面
  const sortedFiles = [...files].sort((a, b) => {
    if (a.name === 'SKILL.md') return -1;
    if (b.name === 'SKILL.md') return 1;
    if (a.type !== b.type) {
      return a.type === 'dir' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </span>
        {githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="h-3 w-3" />
            View on GitHub
          </a>
        )}
      </div>

      {/* File list */}
      <ul>
        {sortedFiles.map((file) => (
          <li key={file.path}>
            <a
              href={file.download_url || `${githubUrl}/${file.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2 text-sm hover:bg-muted/50 transition-colors"
            >
              {getFileIcon(file.name, file.type)}
              <span className={file.name === 'SKILL.md' ? 'font-medium' : ''}>
                {file.name}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
