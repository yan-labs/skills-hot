import { Header } from '@/components/Header';
import { HeadlineSkill } from '@/components/HeadlineSkill';
import { TrendingBoard, TrendingSkill } from '@/components/TrendingBoard';
import { Leaderboard } from '@/components/Leaderboard';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

// Get stats for the stats bar
async function getStats() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { totalSkills: 0, totalInstalls: 0, totalAuthors: 0 };
  }

  const { createClient } = await import('@supabase/supabase-js');
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

// Get the headline skill (fastest growing in 24 hours)
// Calculates 24h change by comparing current snapshot with 24h ago
async function getHeadlineSkill() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 获取最新快照时间
  const { data: latestSnapshotInfo } = await supabase
    .from('skill_snapshots')
    .select('snapshot_at')
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSnapshotInfo) {
    return null;
  }

  const snapshotAt = latestSnapshotInfo.snapshot_at;
  const twentyFourHoursAgo = new Date(new Date(snapshotAt).getTime() - 24 * 60 * 60 * 1000).toISOString();

  // 获取当前快照的所有技能
  const { data: currentSnapshots } = await supabase
    .from('skill_snapshots')
    .select('skill_name, skill_slug, installs, rank')
    .eq('snapshot_at', snapshotAt)
    .limit(1000);

  if (!currentSnapshots || currentSnapshots.length === 0) {
    return null;
  }

  // 获取24小时前的快照
  const { data: oldSnapshots } = await supabase
    .from('skill_snapshots')
    .select('skill_name, installs')
    .gte('snapshot_at', twentyFourHoursAgo)
    .lt('snapshot_at', snapshotAt);

  // 构建24小时前的 installs 映射（取该技能在24h窗口内的最早值）
  const oldInstallsMap = new Map<string, number>();
  if (oldSnapshots) {
    for (const s of oldSnapshots) {
      if (!oldInstallsMap.has(s.skill_name)) {
        oldInstallsMap.set(s.skill_name, s.installs);
      }
    }
  }

  // 计算24小时变化，找出增长最快的
  let maxDelta = -Infinity;
  let topSkillSlug: string | null = null;
  let topDelta = 0;

  for (const current of currentSnapshots) {
    const oldInstalls = oldInstallsMap.get(current.skill_name);
    const delta = oldInstalls !== undefined ? current.installs - oldInstalls : 0;

    if (delta > maxDelta) {
      maxDelta = delta;
      topSkillSlug = current.skill_slug;
      topDelta = delta;
    }
  }

  // 获取完整技能信息
  if (!topSkillSlug) {
    return null;
  }

  const { data: skill } = await supabase
    .from('external_skills')
    .select('*')
    .eq('slug', topSkillSlug)
    .maybeSingle();

  if (!skill) {
    return null;
  }

  const topSkill = { ...skill, installs_delta: topDelta };

  // Get author info - try author_id first, then github_owner
  let authorData = null;

  // Method 1: Direct author_id reference
  if (topSkill.author_id) {
    const { data: author } = await supabase
      .from('authors')
      .select('*')
      .eq('id', topSkill.author_id)
      .maybeSingle();

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
      .maybeSingle();

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
      installs_delta: topSkill.installs_delta || 0,
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

  const { createClient } = await import('@supabase/supabase-js');
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
// 方案 B：24 小时滚动窗口
// New = 最近 24 小时内首次上榜的
async function getTrendingData(): Promise<{
  rising: TrendingSkill[];
  declining: TrendingSkill[];
  newEntries: TrendingSkill[];
  surging: TrendingSkill[];
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { rising: [], declining: [], newEntries: [], surging: [] };
  }

  const { createClient } = await import('@supabase/supabase-js');
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
      return { rising: [], declining: [], newEntries: [], surging: [] };
    }

    const snapshotAt = latestSnapshot.snapshot_at;
    const twentyFourHoursAgo = new Date(new Date(snapshotAt).getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 并行获取基础数据
    const [risingRes, decliningRes, currentSnapshotRes, oldSnapshotsRes, surgingRes] = await Promise.all([
      // 上升 Top 5
      supabase
        .from('skill_snapshots')
        .select('skill_name, skill_slug, github_owner, installs, rank, rank_delta')
        .eq('snapshot_at', snapshotAt)
        .gt('rank_delta', 0)
        .order('rank_delta', { ascending: false })
        .limit(5),

      // 下降 Top 5
      supabase
        .from('skill_snapshots')
        .select('skill_name, skill_slug, github_owner, installs, rank, rank_delta')
        .eq('snapshot_at', snapshotAt)
        .lt('rank_delta', 0)
        .order('rank_delta', { ascending: true })
        .limit(5),

      // 当前快照的所有技能（用于计算 New）
      supabase
        .from('skill_snapshots')
        .select('skill_name, skill_slug, github_owner, installs, rank')
        .eq('snapshot_at', snapshotAt)
        .order('rank', { ascending: true }),

      // 24 小时前的快照（用于计算 New）
      supabase
        .from('skill_snapshots')
        .select('skill_name')
        .gte('snapshot_at', twentyFourHoursAgo)
        .lt('snapshot_at', snapshotAt),

      // 暴涨 Top 5
      supabase
        .from('skill_snapshots')
        .select('skill_name, skill_slug, github_owner, installs, installs_rate')
        .eq('snapshot_at', snapshotAt)
        .gte('installs_rate', 0.2)
        .order('installs_rate', { ascending: false })
        .limit(5),
    ]);

    // New: 在当前快照中，但 24 小时前的任何快照中都不存在
    const oldSkillsNames = new Set((oldSnapshotsRes.data || []).map(s => s.skill_name));
    const newEntries = (currentSnapshotRes.data || [])
      .filter(s => !oldSkillsNames.has(s.skill_name))
      .slice(0, 5);

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
      rank: s.rank,
      rankDelta: s.rank_delta,
      installsRate: s.installs_rate,
    });

    return {
      rising: (risingRes.data || []).map(formatSkill),
      declining: (decliningRes.data || []).map(formatSkill),
      newEntries: newEntries.map(formatSkill),
      surging: (surgingRes.data || []).map(formatSkill),
    };
  } catch (error) {
    console.error('Failed to fetch trending data:', error);
    return { rising: [], declining: [], newEntries: [], surging: [] };
  }
}

type Props = {
  params: Promise<{ locale: string }>;
};

interface HomeJsonLdTranslations {
  inLanguage: string;
  jsonLdDescription: string;
  jsonLdOrgDescription: string;
}

function generateHomeJsonLd(
  locale: string,
  stats: { totalSkills: number; totalInstalls: number },
  t: HomeJsonLdTranslations
) {
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
          description: t.jsonLdDescription,
          inLanguage: t.inLanguage,
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
          description: t.jsonLdOrgDescription,
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
  const tSeo = await getTranslations('seo');
  const tHome = await getTranslations('seo.home');

  // Fetch all data in parallel
  const [stats, headline, leaderboard, trending] = await Promise.all([
    getStats(),
    getHeadlineSkill(),
    getLeaderboardSkills(),
    getTrendingData(),
  ]);

  const jsonLdArray = generateHomeJsonLd(locale, stats, {
    inLanguage: tSeo('inLanguage'),
    jsonLdDescription: tHome('jsonLdDescription'),
    jsonLdOrgDescription: tHome('jsonLdOrgDescription', {
      skills: stats.totalSkills.toLocaleString(),
      installs: stats.totalInstalls.toLocaleString(),
    }),
  });

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
        {tHome('h1')}
      </h1>
      <Header />

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
