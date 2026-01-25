import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/Header';
import { SkillCard } from '@/components/SkillCard';
import { SearchBar } from '@/components/SearchBar';
import { SkillsTabs } from '@/components/SkillsTabs';
import { Package, Lock } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ source?: string; q?: string }>;
};

const SKILLSMP_API_URL = 'https://skillsmp.com/api/v1';

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  author: string;
  is_private?: boolean;
  source: 'local' | 'skillsmp' | 'skills.sh';
  installs?: number;
  skill_stats?: { installs: number }[];
  isFeatured?: boolean;
}

async function getSkills(source: string, userId?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const results: Skill[] = [];

  // For 'my' source, require authentication
  if (source === 'my' && !userId) {
    return { skills: [], needsAuth: true };
  }

  if (!supabaseUrl || !supabaseKey) {
    return { skills: [], needsAuth: false };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get local skills for 'my' or 'local' source
  if (source === 'my' || source === 'local') {
    let query = supabase.from('skills').select('*, skill_stats(installs)');

    if (source === 'my') {
      query = query.eq('user_id', userId);
    } else {
      if (userId) {
        query = query.or(`is_private.eq.false,user_id.eq.${userId}`);
      } else {
        query = query.eq('is_private', false);
      }
    }

    const { data: localSkills } = await query.order('created_at', { ascending: false });

    if (localSkills) {
      for (const skill of localSkills) {
        results.push({
          id: skill.id,
          name: skill.name,
          slug: skill.slug,
          description: skill.description || '',
          author: skill.author || '',
          is_private: skill.is_private,
          source: 'local',
          skill_stats: skill.skill_stats,
        });
      }
    }

    return { skills: results, needsAuth: false };
  }

  // For 'all' or default: show skills.sh featured list (sorted by installs)
  const { data: featuredSkills } = await supabase
    .from('skills_sh_cache')
    .select('name, installs, top_source')
    .order('installs', { ascending: false })
    .limit(50);

  if (featuredSkills) {
    for (const skill of featuredSkills) {
      // Extract author from top_source (e.g., "vercel-labs/agent-skills" -> "vercel-labs")
      const author = skill.top_source?.split('/')[0] || '';

      results.push({
        id: skill.name,
        name: skill.name,
        slug: skill.name,
        description: '', // skills.sh doesn't have description
        author,
        source: 'skills.sh',
        installs: skill.installs,
        isFeatured: true,
      });
    }
  }

  return { skills: results, needsAuth: false };
}

export default async function SkillsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('skills');
  const { source = 'all' } = await searchParams;

  // Get current user from session
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { skills, needsAuth } = await getSkills(source, user?.id);

  const currentTab = (source === 'my' || source === 'skillsmp' ? source : 'all') as
    | 'all'
    | 'my'
    | 'skillsmp';

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8 sm:mb-10">
          <h1 className="mb-2 text-2xl font-semibold sm:text-3xl">
            {source === 'my' ? t('mySkills.title') : t('title')}
          </h1>
          <p className="text-muted-foreground">
            {source === 'my' ? t('mySkills.subtitle') : t('subtitle')}
          </p>
        </div>

        {/* Tabs and Search */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SkillsTabs currentTab={currentTab} isAuthenticated={!!user} />
          <div className="max-w-xs">
            <SearchBar />
          </div>
        </div>

        {/* Content */}
        {needsAuth ? (
          <div className="rounded-lg border border-border p-12 text-center">
            <Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
            <h3 className="mb-2 font-medium">Sign in required</h3>
            <p className="text-sm text-muted-foreground">
              Please sign in to view your skills
            </p>
          </div>
        ) : skills.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => (
              <SkillCard
                key={`${skill.source}-${skill.id}`}
                name={skill.name}
                slug={skill.slug}
                description={skill.description}
                author={skill.author}
                category={null}
                tags={null}
                installs={skill.skill_stats?.[0]?.installs || skill.installs || 0}
                isPrivate={skill.is_private}
                source={skill.source}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border p-12 text-center">
            <Package className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
            <h3 className="mb-2 font-medium">
              {source === 'my' ? t('mySkills.empty') : t('empty')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {source === 'my' ? t('mySkills.emptyHint') : t('emptyHint')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
