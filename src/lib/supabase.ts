import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Skill = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content: string | null;
  author: string | null;
  source_url: string | null;
  category: string | null;
  tags: string[] | null;
  is_paid: boolean;
  price: number | null;
  created_at: string;
  updated_at: string;
};

export type SkillStats = {
  skill_id: string;
  installs: number;
  views: number;
  copies: number;
  favorites: number;
};

export type SkillWithStats = Skill & {
  skill_stats: SkillStats[] | null;
};
