import { Header } from '@/components/Header';
import { SearchBar } from '@/components/SearchBar';
import { SearchTabs } from '@/components/SearchTabs';
import { PlatformFilter } from '@/components/PlatformFilter';
import { SkillsInfiniteList } from '@/components/SkillsInfiniteList';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; platform?: string; type?: string }>;
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

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('search');
  const tSeo = await getTranslations('seo.search');
  const { q, type } = await searchParams;
  const query = q || '';
  const searchType = type || 'skills';

  const jsonLd = generateSearchJsonLd(
    locale,
    {
      name: tSeo('jsonLdName'),
      description: tSeo('jsonLdDescription'),
      breadcrumb: tSeo('breadcrumb'),
    },
    query
  );

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
          <p className="section-label mb-2">{t('label')}</p>
          <h1 className="text-3xl sm:text-4xl">{t('title')}</h1>
        </div>

        {/* Search */}
        <div className="mb-6 max-w-md">
          <SearchBar />
        </div>

        {/* Search Type Tabs */}
        <div className="mb-6">
          <SearchTabs />
        </div>

        {/* Platform Filter - only show for skills */}
        {searchType === 'skills' && (
          <div className="mb-6">
            <PlatformFilter />
          </div>
        )}

        {/* Results with infinite scroll */}
        <SkillsInfiniteList />
      </main>
    </div>
  );
}
