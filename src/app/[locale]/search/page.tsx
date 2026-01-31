import { Header } from '@/components/Header';
import { SearchBar } from '@/components/SearchBar';
import { SkillCard } from '@/components/SkillCard';
import { PlatformFilter } from '@/components/PlatformFilter';
import { Search } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import type { Platform } from '@/lib/supabase';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; platform?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { q } = await searchParams;
  const t = await getTranslations('seo.search');
  const tSeo = await getTranslations('seo');

  const baseTitle = t('title');
  const title = q
    ? `${t('titleWithQuery', { query: q })} | Skills Hot Marketplace`
    : `${t('fullTitle')} | Skills Hot`;

  const description = q
    ? t('descriptionWithQuery', { query: q })
    : t('description');

  const url = q
    ? `https://skills.hot/${locale}/search?q=${encodeURIComponent(q)}`
    : `https://skills.hot/${locale}/search`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        en: q ? `/en/search?q=${encodeURIComponent(q)}` : '/en/search',
        zh: q ? `/zh/search?q=${encodeURIComponent(q)}` : '/zh/search',
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Skills Hot',
      type: 'website',
      locale: tSeo('locale'),
      images: [{
        url: `https://skills.hot/api/og?title=${encodeURIComponent(baseTitle)}&subtitle=${encodeURIComponent(t('subtitle'))}&type=search&locale=${locale}`,
        width: 1200,
        height: 630,
        alt: title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`https://skills.hot/api/og?title=${encodeURIComponent(baseTitle)}&subtitle=${encodeURIComponent(t('subtitle'))}&type=search&locale=${locale}`],
    },
    robots: {
      index: !q, // Don't index search result pages, only the main search page
      follow: true,
    },
  };
}

interface SearchJsonLdTranslations {
  name: string;
  description: string;
  breadcrumb: string;
}

function generateSearchJsonLd(
  locale: string,
  t: SearchJsonLdTranslations,
  query?: string,
  resultsCount?: number
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    name: t.name,
    description: t.description,
    url: query
      ? `https://skills.hot/${locale}/search?q=${encodeURIComponent(query)}`
      : `https://skills.hot/${locale}/search`,
    isPartOf: {
      '@type': 'WebSite',
      '@id': 'https://skills.hot/#website',
      name: 'Skills Hot',
    },
    ...(query && resultsCount !== undefined && {
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: resultsCount,
        itemListElement: [],
      },
    }),
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://skills.hot',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: t.breadcrumb,
          item: `https://skills.hot/${locale}/search`,
        },
      ],
    },
  };
}

async function searchSkills(query: string, platform?: string) {
  if (!query && !platform) return [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return [];
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  let queryBuilder = supabase
    .from('skills')
    .select('*, skill_stats(*)')
    .eq('is_private', false);

  // Add text search filter
  if (query) {
    queryBuilder = queryBuilder.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  }

  // Add platform filter
  if (platform && platform !== 'all') {
    queryBuilder = queryBuilder.contains('platforms', [`"${platform}"`]);
  }

  const { data, error } = await queryBuilder
    .order('created_at', { ascending: false })
    .limit(50);

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
  const { q, platform } = await searchParams;
  const query = q || '';
  const skills = await searchSkills(query, platform);

  const jsonLd = generateSearchJsonLd(locale, query, skills.length);

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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

        {/* Platform Filter */}
        <div className="mb-8">
          <PlatformFilter selectedPlatform={(platform || 'all') as Platform | 'all'} />
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
                      platforms={skill.platforms}
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
