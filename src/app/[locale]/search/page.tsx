import { supabase } from '@/lib/supabase';
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

  const { data, error } = await supabase
    .from('skills')
    .select('*, skill_stats(*)')
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

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Search Header */}
        <div className="mb-8 sm:mb-10">
          <h1 className="mb-6 text-xl font-semibold sm:text-2xl">
            {t('title')}
          </h1>
          <div className="max-w-xl">
            <SearchBar />
          </div>
        </div>

        {/* Results */}
        {query ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {t('results', { count: skills.length, query })}
            </p>

            {skills.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {skills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    name={skill.name}
                    slug={skill.slug}
                    description={skill.description}
                    author={skill.author}
                    category={skill.category}
                    tags={skill.tags}
                    installs={skill.skill_stats?.[0]?.installs || 0}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border p-8 text-center sm:p-12">
                <Search className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50 sm:h-10 sm:w-10" />
                <h3 className="mb-2 font-medium">{t('noResults')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('noResultsHint')}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-border p-8 text-center sm:p-12">
            <Search className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50 sm:h-10 sm:w-10" />
            <h3 className="mb-2 font-medium">{t('enterTerm')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('enterTermHint')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
