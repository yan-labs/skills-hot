import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/Header';
import { SearchBar } from '@/components/SearchBar';
import { SkillCard } from '@/components/SkillCard';
import { Search } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

async function searchSkills(query: string) {
  if (!query) return [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('skills')
    .select('*, skill_stats(*)')
    .eq('is_private', false)
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error searching skills:', error);
    return [];
  }

  return data || [];
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('search');
  const { q } = await searchParams;
  const query = q || '';
  const skills = await searchSkills(query);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Header */}
        <div className="mb-8">
          <p className="section-label mb-2">Search</p>
          <h1 className="text-3xl sm:text-4xl">{t('title')}</h1>
        </div>

        {/* Search */}
        <div className="mb-8 max-w-md">
          <SearchBar />
        </div>

        {/* Divider */}
        <div className="divider" />

        {/* Results */}
        {query ? (
          <div className="py-8">
            <p className="byline mb-6">
              {t('results', { count: skills.length, query })}
            </p>

            {skills.length > 0 ? (
              <div className="stagger">
                {skills.map((skill, index) => (
                  <div
                    key={skill.id}
                    className={index < skills.length - 1 ? 'border-b border-border' : ''}
                  >
                    <SkillCard
                      name={skill.name}
                      slug={skill.slug}
                      description={skill.description}
                      author={skill.author}
                      category={skill.category}
                      tags={skill.tags}
                      installs={skill.skill_stats?.[0]?.installs || 0}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <Search className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
                <h3 className="text-lg">{t('noResults')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('noResultsHint')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Search className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
            <h3 className="text-lg">{t('enterTerm')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('enterTermHint')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
