import { createClient } from '@supabase/supabase-js';
import { SearchBar } from '@/components/SearchBar';
import { HeadlineSkill } from '@/components/HeadlineSkill';
import { TrendingBoard, TrendingSkill } from '@/components/TrendingBoard';
import { Leaderboard } from '@/components/Leaderboard';
import { ThemeToggle } from '@/components/ThemeToggle';
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

// Get the headline skill (fastest growing in last 24 hours) and its author
async function getHeadlineSkill() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 获取最新快照中 installs_delta 最高的技能（24小时增长最快）
  const { data: topSnapshot } = await supabase
    .from('skill_snapshots')
    .select('skill_name, skill_slug, installs_delta')
    .order('snapshot_at', { ascending: false })
    .order('installs_delta', { ascending: false })
    .limit(1)
    .single();

  // 如果有快照数据且有增长，使用快照中的技能
  let topSkill = null;

  if (topSnapshot && topSnapshot.installs_delta > 0) {
    const { data: skill } = await supabase
      .from('external_skills')
      .select('*')
      .eq('slug', topSnapshot.skill_slug)
      .single();

    if (skill) {
      topSkill = { ...skill, installs_delta: topSnapshot.installs_delta };
    }
  }

  // 回退：如果没有快照数据或没有增长，使用安装量最高的
  if (!topSkill) {
    const { data: fallbackSkill, error } = await supabase
      .from('external_skills')
      .select('*')
      .order('installs', { ascending: false })
      .limit(1)
      .single();

    if (error || !fallbackSkill) {
      return null;
    }
    topSkill = fallbackSkill;
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
      installs_delta: topSkill.installs_delta || 0, // 24小时增长量
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

// Get trending data from skill_snapshots table
async function getTrendingData(): Promise<{
  rising: TrendingSkill[];
  declining: TrendingSkill[];
  newEntries: TrendingSkill[];
  dropped: TrendingSkill[];
  surging: TrendingSkill[];
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { rising: [], declining: [], newEntries: [], dropped: [], surging: [] };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 获取最新快照时间
    const { data: latestSnapshot } = await supabase
      .from('skill_snapshots')
      .select('snapshot_at')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestSnapshot) {
      return { rising: [], declining: [], newEntries: [], dropped: [], surging: [] };
    }

    const snapshotAt = latestSnapshot.snapshot_at;

    // 并行获取各类趋势数据
    const [risingRes, decliningRes, newEntriesRes, droppedRes, surgingRes] = await Promise.all([
      // 上升 Top 5（排名上升且非新晋）
      supabase
        .from('skill_snapshots')
        .select('skill_name, skill_slug, github_owner, installs, rank_delta')
        .eq('snapshot_at', snapshotAt)
        .gt('rank_delta', 0)
        .eq('is_new', false)
        .order('rank_delta', { ascending: false })
        .limit(5),

      // 下降 Top 5
      supabase
        .from('skill_snapshots')
        .select('skill_name, skill_slug, github_owner, installs, rank_delta')
        .eq('snapshot_at', snapshotAt)
        .lt('rank_delta', 0)
        .order('rank_delta', { ascending: true })
        .limit(5),

      // 新晋 Top 5
      supabase
        .from('skill_snapshots')
        .select('skill_name, skill_slug, github_owner, installs, rank')
        .eq('snapshot_at', snapshotAt)
        .eq('is_new', true)
        .order('rank', { ascending: true })
        .limit(5),

      // 掉榜 Top 5
      supabase
        .from('skill_snapshots')
        .select('skill_name, skill_slug, github_owner, installs, rank')
        .eq('snapshot_at', snapshotAt)
        .eq('is_dropped', true)
        .order('rank', { ascending: true })
        .limit(5),

      // 暴涨 Top 5（安装量增长 >= 30%）
      supabase
        .from('skill_snapshots')
        .select('skill_name, skill_slug, github_owner, installs, installs_rate')
        .eq('snapshot_at', snapshotAt)
        .gte('installs_rate', 0.3)
        .order('installs_rate', { ascending: false })
        .limit(5),
    ]);

    const formatSkill = (s: {
      skill_name: string;
      skill_slug: string;
      github_owner: string | null;
      installs: number;
      rank_delta?: number;
      rank?: number;
      installs_rate?: number;
    }): TrendingSkill => ({
      name: s.skill_name,
      slug: s.skill_slug,
      author: s.github_owner || undefined,
      installs: s.installs,
      rankDelta: s.rank_delta,
      previousRank: s.rank,
      installsRate: s.installs_rate,
    });

    return {
      rising: (risingRes.data || []).map(formatSkill),
      declining: (decliningRes.data || []).map(formatSkill),
      newEntries: (newEntriesRes.data || []).map(formatSkill),
      dropped: (droppedRes.data || []).map(formatSkill),
      surging: (surgingRes.data || []).map(formatSkill),
    };
  } catch (error) {
    console.error('Failed to fetch trending data:', error);
    return { rising: [], declining: [], newEntries: [], dropped: [], surging: [] };
  }
}

type Props = {
  params: Promise<{ locale: string }>;
};

function generateHomeJsonLd(locale: string, stats: { totalSkills: number; totalInstalls: number }) {
  // Use a single graph with @id references for better schema validation
  return [
    {
      '@context': 'https://schema.org',
      '@graph': [
        // WebSite with SearchAction
        {
          '@type': 'WebSite',
          '@id': 'https://skills.hot/#website',
          name: 'Skills Hot',
          url: 'https://skills.hot',
          description: locale === 'zh'
            ? 'AI 代理技能市场 - 为 Claude Code、Cursor、Windsurf 等 AI 编程代理安装技能'
            : 'AI Agent Skill Marketplace - Install skills for Claude Code, Cursor, Windsurf and other AI coding agents',
          inLanguage: locale === 'zh' ? 'zh-CN' : 'en-US',
          publisher: { '@id': 'https://skills.hot/#organization' },
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `https://skills.hot/${locale}/search?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
          },
        },
        // Organization
        {
          '@type': 'Organization',
          '@id': 'https://skills.hot/#organization',
          name: 'Skills Hot',
          url: 'https://skills.hot',
          logo: 'https://skills.hot/logo.png',
          sameAs: ['https://github.com/yan-labs/skills-hot'],
          description: locale === 'zh'
            ? `AI 代理技能市场，拥有 ${stats.totalSkills.toLocaleString()} 个技能和 ${stats.totalInstalls.toLocaleString()} 次安装`
            : `AI Agent Skill Marketplace with ${stats.totalSkills.toLocaleString()} skills and ${stats.totalInstalls.toLocaleString()} total installs`,
        },
        // SoftwareApplication (the CLI tool)
        {
          '@type': 'SoftwareApplication',
          '@id': 'https://skills.hot/#cli',
          name: 'Skills Hot CLI',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'macOS, Windows, Linux',
          downloadUrl: 'https://www.npmjs.com/package/@skills-hot/cli',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          author: { '@id': 'https://skills.hot/#organization' },
        },
      ],
    },
  ];
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();

  // Fetch all data in parallel
  const [stats, headline, leaderboard, trending] = await Promise.all([
    getStats(),
    getHeadlineSkill(),
    getLeaderboardSkills(),
    getTrendingData(),
  ]);

  const jsonLdArray = generateHomeJsonLd(locale, stats);

  return (
    <>
      {/* JSON-LD Structured Data - rendered at top level for proper head placement */}
      {jsonLdArray.map((jsonLd, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ))}
      <div className="min-h-screen bg-background">
      {/* SEO H1 - visually hidden but accessible */}
      <h1 className="sr-only">
        {locale === 'zh' ? 'Skills Hot - AI 代理技能市场' : 'Skills Hot - AI Agent Skills Marketplace'}
      </h1>
      {/* Combined Masthead: Header + Stats + Hero */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Top row: Logo + Nav + Actions */}
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold">
                Skills Hot
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
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Headline Skill Section - directly after header */}
        {headline && (
          <>
            <HeadlineSkill
              skill={headline.skill}
              author={headline.author}
            />
            <div className="divider" />
          </>
        )}

        {/* Trending Board - Market Movers */}
        <TrendingBoard
          rising={trending.rising}
          declining={trending.declining}
          newEntries={trending.newEntries}
          dropped={trending.dropped}
          surging={trending.surging}
        />

        <div className="divider" />

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
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">{t('footer.copyright')}</p>
              <p className="text-xs text-muted-foreground">Annals, Inc.</p>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/docs" className="transition-colors hover:text-foreground">
                {t('header.docs')}
              </Link>
              <a
                href="https://github.com/yan-labs/skills-hot"
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
    </>
  );
}
