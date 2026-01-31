import { Header } from '@/components/Header';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Download, Package, Star, Users } from 'lucide-react';
import type { Author } from '@/lib/supabase';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

const ITEMS_PER_PAGE = 50;

interface AuthorWithStats extends Author {
  skill_count: number;
}

async function getAuthors(
  sort: string = 'stars',
  page: number = 1,
  limit: number = 50
): Promise<{ authors: AuthorWithStats[]; total: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { authors: [], total: 0 };
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const offset = (page - 1) * limit;

  // Get total count
  const { count } = await supabase
    .from('authors')
    .select('*', { count: 'exact', head: true });

  // Get authors with sorting
  const orderColumn = sort === 'skills'
    ? 'external_skill_count'
    : sort === 'stars'
      ? 'total_stars'
      : 'total_installs';

  const { data: authors, error } = await supabase
    .from('authors')
    .select('*')
    .order(orderColumn, { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching authors:', error);
    return { authors: [], total: 0 };
  }

  return {
    authors: (authors || []).map(a => ({
      ...a,
      skill_count: a.external_skill_count + a.native_skill_count,
    })),
    total: count || 0,
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { sort = 'stars', page = '1' } = await searchParams;
  const currentPage = parseInt(page, 10) || 1;
  const t = await getTranslations('seo.authors');
  const tSeo = await getTranslations('seo');

  // Get total count for pagination metadata
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let totalPages = 1;

  if (supabaseUrl && supabaseKey) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { count } = await supabase
      .from('authors')
      .select('*', { count: 'exact', head: true });
    totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE);
  }

  const baseTitle = t('title');
  const title = currentPage > 1
    ? `${t('titleWithPage', { page: currentPage })} | Skills Hot`
    : `${t('fullTitle')} | Skills Hot`;

  const description = t('description');

  const baseUrl = `https://skills.hot/${locale}/authors`;
  const currentUrl = currentPage > 1 ? `${baseUrl}?sort=${sort}&page=${currentPage}` : baseUrl;

  // Build pagination links
  const paginationLinks: { prev?: string; next?: string } = {};
  if (currentPage > 1) {
    paginationLinks.prev = currentPage === 2
      ? `/${locale}/authors${sort !== 'stars' ? `?sort=${sort}` : ''}`
      : `/${locale}/authors?sort=${sort}&page=${currentPage - 1}`;
  }
  if (currentPage < totalPages) {
    paginationLinks.next = `/${locale}/authors?sort=${sort}&page=${currentPage + 1}`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: currentUrl,
      languages: {
        en: currentPage > 1 ? `/en/authors?sort=${sort}&page=${currentPage}` : '/en/authors',
        zh: currentPage > 1 ? `/zh/authors?sort=${sort}&page=${currentPage}` : '/zh/authors',
      },
    },
    openGraph: {
      title,
      description,
      url: currentUrl,
      siteName: 'Skills Hot',
      type: 'website',
      locale: tSeo('locale'),
      images: [{
        url: `https://skills.hot/api/og?title=${encodeURIComponent(baseTitle)}&subtitle=${encodeURIComponent(t('subtitle'))}&type=author&locale=${locale}`,
        width: 1200,
        height: 630,
        alt: title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`https://skills.hot/api/og?title=${encodeURIComponent(baseTitle)}&subtitle=${encodeURIComponent(t('subtitle'))}&type=author&locale=${locale}`],
    },
    other: {
      ...(paginationLinks.prev && { 'link:prev': paginationLinks.prev }),
      ...(paginationLinks.next && { 'link:next': paginationLinks.next }),
    },
  };
}

interface JsonLdTranslations {
  title: string;
  totalDescription: string;
  breadcrumb: string;
}

function generateAuthorsJsonLd(locale: string, total: number, t: JsonLdTranslations) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.title,
    description: t.totalDescription,
    url: `https://skills.hot/${locale}/authors`,
    isPartOf: {
      '@type': 'WebSite',
      '@id': 'https://skills.hot/#website',
      name: 'Skills Hot',
    },
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
          item: `https://skills.hot/${locale}/authors`,
        },
      ],
    },
  };
}

export default async function AuthorsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { sort = 'stars', page = '1' } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('authors');
  const tSeo = await getTranslations('seo.authors');
  const currentPage = parseInt(page, 10) || 1;
  const { authors, total } = await getAuthors(sort, currentPage);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const jsonLd = generateAuthorsJsonLd(locale, total, {
    title: tSeo('title'),
    totalDescription: tSeo('totalDescription', { total }),
    breadcrumb: tSeo('breadcrumb'),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="section-label mb-2">{t('badge')}</p>
          <h1 className="text-3xl sm:text-4xl">
            {tSeo('fullTitle')}
          </h1>
          <p className="byline mt-2">{t('subtitle')}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground mb-8">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{total.toLocaleString()} {t('totalAuthors')}</span>
          </div>
        </div>

        {/* Sort Tabs */}
        <div className="flex gap-4 py-4">
          <Link
            href="/authors"
            className={`text-sm transition-colors ${
              sort === 'stars'
                ? 'text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('sort.stars')}
          </Link>
          <Link
            href="/authors?sort=installs"
            className={`text-sm transition-colors ${
              sort === 'installs'
                ? 'text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('sort.installs')}
          </Link>
          <Link
            href="/authors?sort=skills"
            className={`text-sm transition-colors ${
              sort === 'skills'
                ? 'text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('sort.skills')}
          </Link>
        </div>

        {/* Authors List */}
        {authors.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">{t('noAuthors')}</p>
          </div>
        ) : (
          <div className="stagger">
            {authors.map((author, index) => (
              <Link
                key={author.id}
                href={`/authors/${author.github_login}`}
                className={`group flex items-center gap-4 py-4 transition-colors hover:bg-muted/30 ${
                  index < authors.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                {/* Avatar */}
                {author.avatar_url ? (
                  <img
                    src={author.avatar_url}
                    alt={author.name || author.github_login}
                    className="h-12 w-12 rounded-full flex-shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg transition-colors group-hover:text-accent truncate">
                      {author.name || author.github_login}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      @{author.github_login}
                    </span>
                  </div>
                  {author.bio && (
                    <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                      {author.bio}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground flex-shrink-0">
                  <div className="flex items-center gap-1.5" title={t('skills')}>
                    <Package className="h-4 w-4" />
                    <span>{author.skill_count}</span>
                  </div>
                  <div className="flex items-center gap-1.5" title={t('installs')}>
                    <Download className="h-4 w-4" />
                    <span>{author.total_installs.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-[60px] justify-end" title={t('stars')}>
                    <Star className="h-4 w-4" />
                    <span>{(author.total_stars || 0).toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {currentPage > 1 && (
              <Link
                href={`/authors?sort=${sort}&page=${currentPage - 1}`}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
              >
                {t('prev')}
              </Link>
            )}
            <span className="px-4 py-2 text-sm text-muted-foreground">
              {t('page', { current: currentPage, total: totalPages })}
            </span>
            {currentPage < totalPages && (
              <Link
                href={`/authors?sort=${sort}&page=${currentPage + 1}`}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
              >
                {t('next')}
              </Link>
            )}
          </div>
        )}
      </main>
      </div>
    </>
  );
}
