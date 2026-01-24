'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

type Props = {
  skillSlug: string;
  skillId?: string;
};

export function SkillTracker({ skillSlug, skillId }: Props) {
  useEffect(() => {
    // Track view on mount (deduplicated by session)
    trackEvent(skillSlug, 'view', skillId);
  }, [skillSlug, skillId]);

  return null;
}
