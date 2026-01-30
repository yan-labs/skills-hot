import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors when env vars are not available
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured');
    }

    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Deprecated: use getSupabase() instead for lazy initialization
// This getter maintains backward compatibility but creates the client on first access
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});

// Runtime platform enum (aligned with skills.sh)
export type Platform =
  | 'amp'
  | 'antigravity'
  | 'claudecode'
  | 'clawdbot'
  | 'cline'
  | 'codex'
  | 'copilot'
  | 'cursor'
  | 'droid'
  | 'gemini'
  | 'goose'
  | 'kilo'
  | 'kiro-cli'
  | 'manus'
  | 'moltbot'
  | 'opencode'
  | 'roo'
  | 'trae'
  | 'universal'
  | 'windsurf';

export const PLATFORMS: Record<Platform, string> = {
  amp: 'AMP',
  antigravity: 'Antigravity',
  claudecode: 'Claude Code',
  clawdbot: 'ClawdBot',
  cline: 'Cline',
  codex: 'Codex',
  copilot: 'Copilot',
  cursor: 'Cursor',
  droid: 'Droid',
  gemini: 'Gemini',
  goose: 'Goose',
  kilo: 'Kilo',
  'kiro-cli': 'Kiro CLI',
  manus: 'Manus',
  moltbot: 'MoltBot',
  opencode: 'OpenCode',
  roo: 'Roo',
  trae: 'Trae',
  universal: 'Universal',
  windsurf: 'Windsurf',
};

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
  platforms: Platform[] | null;
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

export type SkillsShCache = {
  name: string;
  installs: number;
  top_source: string | null;
  synced_at: string;
};

// ========================================
// Skills Hot V2 Types
// ========================================

export type Author = {
  id: string;
  github_id: number;
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  user_id: string | null;
  external_skill_count: number;
  native_skill_count: number;
  total_installs: number;
  created_at: string;
  updated_at: string;
};

export type ExternalSkill = {
  id: string;
  source: string;
  source_id: string;
  name: string;
  slug: string;
  description: string | null;
  repo: string;
  repo_path: string | null;
  branch: string;
  raw_url: string | null;
  author_id: string | null;
  github_owner: string | null;
  installs: number;
  stars: number;
  platforms: Platform[] | null;
  synced_at: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
};

export type ExternalSkillWithAuthor = ExternalSkill & {
  author: Author | null;
};

export type SkillFile = {
  id: string;
  skill_id: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  storage_key: string | null;
  content_hash: string | null;
  created_at: string;
};

// Extended Skill type with new V2 fields
export type SkillV2 = Skill & {
  user_id: string | null;
  version: string | null;
  storage_path: string | null;
  has_files: boolean;
  is_private: boolean;
  author_id: string | null;
  imported_from: string | null;
};

export type SkillV2WithAuthor = SkillV2 & {
  author: Author | null;
  skill_stats: SkillStats | null;
};

// Unified skill detail type for API responses
export type SkillDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  author: string | null;
  category: string | null;
  tags: string[] | null;
  platforms: Platform[] | null;
  source: 'local' | 'github' | 'skillsmp';
  contentSource: 'database' | 'github';
  installs: number;
  stars?: number;
  views?: number;
  copies?: number;
  version?: string | null;
  has_files?: boolean;
  is_private?: boolean;
  // GitHub specific fields
  repo?: string;
  repo_path?: string | null;
  raw_url?: string | null;
  github_owner?: string | null;
  // Author info
  author_info?: Author | null;
  created_at: string;
  updated_at: string;
};
