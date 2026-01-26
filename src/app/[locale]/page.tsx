import { createClient } from '@supabase/supabase-js';
import { SearchBar } from '@/components/SearchBar';
import { HeadlineSkill } from '@/components/HeadlineSkill';
import { Leaderboard } from '@/components/Leaderboard';
import { CodeBlock } from '@/components/CodeBlock';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

// Get stats for the stats bar
async function getStats() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { totalSkills: 0, totalInstalls: 0, totalAuthors: 0 };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get counts in parallel
  const [skillsCount, externalCount, authorsCount, installsSum] = await Promise.all([
    supabase.from('skills').select('id', { count: 'exact', head: true }).eq('is_private', false),
    supabase.from('external_skills').select('id', { count: 'exact', head: true }),
    supabase.from('authors').select('id', { count: 'exact', head: true }),
    supabase.from('external_skills').select('installs'),
  ]);

  const totalSkills = (skillsCount.count || 0) + (externalCount.count || 0);
  const totalAuthors = authorsCount.count || 0;
  const totalInstalls = (installsSum.data || []).reduce((sum, s) => sum + (s.installs || 0), 0);

  return { totalSkills, totalInstalls, totalAuthors };
}

// Get the headline skill (top 1 by installs) and its author
async function getHeadlineSkill() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get top skill from external_skills (most data)
  const { data: topSkill, error } = await supabase
    .from('external_skills')
    .select('*')
    .order('installs', { ascending: false })
    .limit(1)
    .single();

  if (error || !topSkill) {
    return null;
  }

  // Get author info - try author_id first, then github_owner
  let authorData = null;

  // Method 1: Direct author_id reference
  if (topSkill.author_id) {
    const { data: author } = await supabase
      .from('authors')
      .select('*')
      .eq('id', topSkill.author_id)
      .single();

    if (author) {
      authorData = {
        github_login: author.github_login,
        name: author.name,
        avatar_url: author.avatar_url,
        external_skill_count: author.external_skill_count || 0,
        total_installs: author.total_installs || 0,
      };
    }
  }

  // Method 2: Fallback to github_owner lookup (case-insensitive)
  if (!authorData && topSkill.github_owner) {
    const { data: author } = await supabase
      .from('authors')
      .select('*')
      .ilike('github_login', topSkill.github_owner)
      .single();

    if (author) {
      authorData = {
        github_login: author.github_login,
        name: author.name,
        avatar_url: author.avatar_url,
        external_skill_count: author.external_skill_count || 0,
        total_installs: author.total_installs || 0,
      };
    }
  }

  return {
    skill: {
      name: topSkill.name,
      slug: topSkill.slug,
      description: topSkill.description,
      installs: topSkill.installs || 0,
      stars: topSkill.stars || 0,
      repo: topSkill.repo,
    },
    author: authorData,
  };
}

// Get leaderboard skills
async function getLeaderboardSkills() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { mostInstalled: [], mostStarred: [] };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get most installed (skip the first one as it's the headline)
  const { data: mostInstalled } = await supabase
    .from('external_skills')
    .select('name, slug, github_owner, installs, stars')
    .order('installs', { ascending: false })
    .range(1, 10); // Skip first, get 2-11

  // Get most starred
  const { data: mostStarred } = await supabase
    .from('external_skills')
    .select('name, slug, github_owner, installs, stars')
    .order('stars', { ascending: false })
    .limit(10);

  const formatSkills = (skills: typeof mostInstalled) =>
    (skills || []).map((s) => ({
      name: s.name,
      slug: s.slug,
      author: s.github_owner,
      installs: s.installs || 0,
      stars: s.stars || 0,
    }));

  return {
    mostInstalled: formatSkills(mostInstalled),
    mostStarred: formatSkills(mostStarred),
  };
}

type Props = {
  params: Promise<{ locale: string }>;
};

function generateHomeJsonLd(locale: string, stats: { totalSkills: number; totalInstalls: number }) {
  return [
    // WebSite with SearchAction
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'SkillBank',
      url: 'https://skillbank.dev',
      description: 'AI Agent Skill Marketplace - Install skills for Claude Code, Cursor, Windsurf and other AI coding agents',
      inLanguage: locale === 'zh' ? 'zh-CN' : 'en-US',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `https://skillbank.dev/${locale}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    // Organization
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'SkillBank',
      url: 'https://skillbank.dev',
      logo: 'https://skillbank.dev/logo.png',
      sameAs: ['https://github.com/yan-labs/skillbank'],
      description: `AI Agent Skill Marketplace with ${stats.totalSkills.toLocaleString()} skills and ${stats.totalInstalls.toLocaleString()} total installs`,
    },
    // SoftwareApplication (the platform itself)
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'SkillBank CLI',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Cross-platform',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '5',
        ratingCount: stats.totalInstalls.toString(),
      },
    },
  ];
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();

  // Fetch all data in parallel
  const [stats, headline, leaderboard] = await Promise.all([
    getStats(),
    getHeadlineSkill(),
    getLeaderboardSkills(),
  ]);

  const jsonLdArray = generateHomeJsonLd(locale, stats);

  return (
    <div className="min-h-screen bg-background">
      {/* JSON-LD Structured Data */}
      {jsonLdArray.map((jsonLd, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ))}
      {/* Combined Masthead: Header + Stats + Hero */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Top row: Logo + Nav + Actions */}
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold">
                SkillBank
              </Link>
              <nav className="hidden items-center gap-6 text-sm md:flex">
                <Link href="/authors" className="text-muted-foreground transition-colors hover:text-foreground">
                  {t('header.authors')}
                </Link>
                <Link href="/docs" className="text-muted-foreground transition-colors hover:text-foreground">
                  {t('header.docs')}
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              {/* Stats inline */}
              <div className="hidden items-center gap-4 text-sm lg:flex">
                <span className="font-mono font-medium">{formatNumber(stats.totalSkills)}</span>
                <span className="text-muted-foreground">skills</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono font-medium">{formatNumber(stats.totalInstalls)}</span>
                <span className="text-muted-foreground">installs</span>
              </div>
              <div className="h-4 w-px bg-border hidden lg:block" />
              <SearchBar compact />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero - minimal */}
        <section className="py-6 sm:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl">
                {t('hero.title1')} <span className="text-muted-foreground">{t('hero.title2')}</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <CodeBlock code="npx @anthropic/claude-code" />
            </div>
          </div>
        </section>

        {/* Single divider */}
        <div className="divider" />

        {/* Headline Skill Section */}
        {headline && (
          <>
            <HeadlineSkill
              skill={headline.skill}
              author={headline.author}
              rank={1}
              growthPercent={12}
            />
            <div className="divider" />
          </>
        )}

        {/* Leaderboard Section */}
        <Leaderboard
          mostInstalled={leaderboard.mostInstalled}
          mostStarred={leaderboard.mostStarred}
        />

        {/* Divider */}
        <div className="divider" />

        {/* Features - simple text layout */}
        <section className="py-8">
          <p className="section-label mb-6">{t('features.cliFirst.title').toUpperCase()}</p>

          <div className="grid gap-8 sm:grid-cols-3 sm:gap-12">
            <div>
              <h3 className="text-lg">{t('features.cliFirst.title')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t('features.cliFirst.description')}
              </p>
            </div>
            <div>
              <h3 className="text-lg">{t('features.openSecure.title')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t('features.openSecure.description')}
              </p>
            </div>
            <div>
              <h3 className="text-lg">{t('features.universal.title')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t('features.universal.description')}
              </p>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="divider" />

        {/* Footer */}
        <footer className="py-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">{t('footer.copyright')}</p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/docs" className="transition-colors hover:text-foreground">
                {t('header.docs')}
              </Link>
              <a
                href="https://github.com/yan-labs/skillbank"
                className="transition-colors hover:text-foreground"
              >
                {t('header.github')}
              </a>
              <Link href="/api" className="transition-colors hover:text-foreground">
                {t('footer.api')}
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
