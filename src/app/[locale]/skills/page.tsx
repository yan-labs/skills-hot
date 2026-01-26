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

  if (source === 'my' && !userId) {
    return { skills: [], needsAuth: true };
  }

  if (!supabaseUrl || !supabaseKey) {
    return { skills: [], needsAuth: false };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

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

  const { data: featuredSkills } = await supabase
    .from('skills_sh_cache')
    .select('name, installs, top_source')
    .order('installs', { ascending: false })
    .limit(50);

  if (featuredSkills) {
    for (const skill of featuredSkills) {
      const author = skill.top_source?.split('/')[0] || '';

      results.push({
        id: skill.name,
        name: skill.name,
        slug: skill.name,
        description: '',
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

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Header */}
        <div className="mb-8">
          <p className="section-label mb-2">Directory</p>
          <h1 className="text-3xl sm:text-4xl">
            {source === 'my' ? t('mySkills.title') : t('title')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {source === 'my' ? t('mySkills.subtitle') : t('subtitle')}
          </p>
        </div>

        {/* Divider */}
        <div className="divider" />

        {/* Tabs and Search */}
        <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <SkillsTabs currentTab={currentTab} isAuthenticated={!!user} />
          <div className="w-full max-w-xs">
            <SearchBar />
          </div>
        </div>

        {/* Divider */}
        <div className="divider" />

        {/* Content */}
        {needsAuth ? (
          <div className="py-16 text-center">
            <Lock className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
            <h3 className="text-lg">Sign in required</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Please sign in to view your skills
            </p>
          </div>
        ) : skills.length > 0 ? (
          <div className="stagger">
            {skills.map((skill, index) => (
              <div
                key={`${skill.source}-${skill.id}`}
                className={index < skills.length - 1 ? 'border-b border-border' : ''}
              >
                <SkillCard
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
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Package className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
            <h3 className="text-lg">
              {source === 'my' ? t('mySkills.empty') : t('empty')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {source === 'my' ? t('mySkills.emptyHint') : t('emptyHint')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
