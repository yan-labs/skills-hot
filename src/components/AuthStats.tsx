'use client';

import { useAuth } from '@/components/AuthProvider';
import { Eye, Copy } from 'lucide-react';

type Props = {
  views?: number;
  copies?: number;
};

export function AuthStats({ views = 0, copies = 0 }: Props) {
  const { user, loading } = useAuth();

  // 未登录或加载中不显示
  if (loading || !user) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          Views
        </span>
        <span>{views.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Copy className="h-3.5 w-3.5" />
          Copies
        </span>
        <span>{copies.toLocaleString()}</span>
      </div>
    </>
  );
}
