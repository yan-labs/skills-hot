import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/Header';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Download, Package, Users } from 'lucide-react';
import type { Author } from '@/lib/supabase';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

interface AuthorWithStats extends Author {
  skill_count: number;
}

async function getAuthors(
  sort: string = 'installs',
  page: number = 1,
  limit: number = 50
): Promise<{ authors: AuthorWithStats[]; total: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { authors: [], total: 0 };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const offset = (page - 1) * limit;

  // Get total count
  const { count } = await supabase
    .from('authors')
    .select('*', { count: 'exact', head: true });

  // Get authors with sorting
  const orderColumn = sort === 'skills' ? 'external_skill_count' : 'total_installs';

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

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'authors' });

  return {
    title: `${t('title')} - SkillBank`,
    description: t('subtitle'),
    alternates: {
      canonical: `https://skillbank.dev/${locale}/authors`,
      languages: {
        en: '/en/authors',
        zh: '/zh/authors',
      },
    },
  };
}

export default async function AuthorsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { sort = 'installs', page = '1' } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('authors');
  const currentPage = parseInt(page, 10) || 1;
  const { authors, total } = await getAuthors(sort, currentPage);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="section-label mb-2">{t('badge')}</p>
          <h1 className="text-3xl sm:text-4xl">{t('title')}</h1>
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
        <div className="flex gap-4 py-4 border-b border-border">
          <Link
            href="/authors"
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
                <div className="flex items-center gap-6 text-sm text-muted-foreground flex-shrink-0">
                  <div className="flex items-center gap-1.5" title={t('skills')}>
                    <Package className="h-4 w-4" />
                    <span>{author.skill_count}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-[80px] justify-end" title={t('installs')}>
                    <Download className="h-4 w-4" />
                    <span>{author.total_installs.toLocaleString()}</span>
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
  );
}
