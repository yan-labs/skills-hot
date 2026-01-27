'use client';

import { useEffect } from 'react';
import { trackView } from '@/lib/analytics';

type Props = {
  skillSlug: string;
};

export function SkillTracker({ skillSlug }: Props) {
  useEffect(() => {
    trackView(skillSlug);
  }, [skillSlug]);

  return null;
}
