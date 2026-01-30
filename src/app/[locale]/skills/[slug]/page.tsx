import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/Header';
import { notFound } from 'next/navigation';
import { ExternalLink, ArrowLeft, Github, Star, Download, Info } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { CopyButton } from '@/components/CopyButton';
import { ThirdPartyCopyButton } from '@/components/ThirdPartyCopyButton';
import { SkillTracker } from '@/components/SkillTracker';
import { PlatformBadge } from '@/components/PlatformBadge';
import { MarkdownContent } from '@/components/MarkdownContent';
import { AuthStats } from '@/components/AuthStats';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchGitHubContent, fetchSkillContent, getGitHubRawUrl, parseTopSource } from '@/lib/github-content';
import type { SkillDetail } from '@/lib/supabase';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

async function getSkill(slug: string): Promise<SkillDetail | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: localSkill } = await supabase
    .from('skills')
    .select('*, skill_stats(installs, views, copies)')
    .eq('slug', slug)
    .single();

  if (localSkill && !localSkill.is_private) {
    return {
      id: localSkill.id,
      name: localSkill.name,
      slug: localSkill.slug,
      description: localSkill.description,
      author: localSkill.author,
      category: localSkill.category,
      tags: localSkill.tags,
      platforms: localSkill.platforms,
      source: 'local',
      contentSource: 'database',
      installs: localSkill.skill_stats?.installs || 0,
      views: localSkill.skill_stats?.views || 0,
      copies: localSkill.skill_stats?.copies || 0,
      version: localSkill.version,
      has_files: localSkill.has_files,
      is_private: localSkill.is_private,
      author_info: null,
      created_at: localSkill.created_at,
      updated_at: localSkill.updated_at,
    };
  }

  const { data: externalSkill } = await supabase
    .from('external_skills')
    .select('*, author:authors(*)')
    .eq('slug', slug)
    .single();

  if (externalSkill) {
    return {
      id: externalSkill.id,
      name: externalSkill.name,
      slug: externalSkill.slug,
      description: externalSkill.description,
      author: externalSkill.github_owner,
      category: null,
      tags: null,
      platforms: externalSkill.platforms,
      source: 'github',
      contentSource: 'github',
      installs: externalSkill.installs,
      stars: externalSkill.stars,
      repo: externalSkill.repo,
      repo_path: externalSkill.repo_path,
      raw_url: externalSkill.raw_url,
      github_owner: externalSkill.github_owner,
      author_info: externalSkill.author || null,
      created_at: externalSkill.created_at,
      updated_at: externalSkill.updated_at,
    };
  }

  const { data: externalByName } = await supabase
    .from('external_skills')
    .select('*, author:authors(*)')
    .eq('name', slug)
    .single();

  if (externalByName) {
    return {
      id: externalByName.id,
      name: externalByName.name,
      slug: externalByName.slug,
      description: externalByName.description,
      author: externalByName.github_owner,
      category: null,
      tags: null,
      platforms: externalByName.platforms,
      source: 'github',
      contentSource: 'github',
      installs: externalByName.installs,
      stars: externalByName.stars,
      repo: externalByName.repo,
      repo_path: externalByName.repo_path,
      raw_url: externalByName.raw_url,
      github_owner: externalByName.github_owner,
      author_info: externalByName.author || null,
      created_at: externalByName.created_at,
      updated_at: externalByName.updated_at,
    };
  }

  return null;
}

async function getSkillContent(skill: SkillDetail): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (skill.contentSource === 'database' && supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from('skills')
      .select('content')
      .eq('id', skill.id)
      .single();

    return data?.content || '';
  }

  // 使用智能获取函数尝试多种可能的路径
  if (skill.repo) {
    const { owner, repo } = parseTopSource(skill.repo);
    return await fetchSkillContent(owner, repo, skill.name, skill.repo_path);
  }

  // 回退到 raw_url（如果有的话）
  if (skill.raw_url) {
    return await fetchGitHubContent(skill.raw_url);
  }

  return '';
}

async function getSkillRank(skillId: string, source: string): Promise<number | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get skills ordered by installs to find rank
  if (source === 'local') {
    const { data: skills } = await supabase
      .from('skills')
      .select('id, skill_stats(installs)')
      .eq('is_private', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!skills) return null;

    // Sort by installs
    const sorted = skills.sort((a, b) => {
      const bStats = Array.isArray(b.skill_stats) ? b.skill_stats[0] : b.skill_stats;
      const aStats = Array.isArray(a.skill_stats) ? a.skill_stats[0] : a.skill_stats;
      return ((bStats as { installs: number } | null)?.installs || 0) -
        ((aStats as { installs: number } | null)?.installs || 0);
    });
    const rank = sorted.findIndex(s => s.id === skillId) + 1;
    return rank > 0 ? rank : null;
  } else {
    const { data: skills } = await supabase
      .from('external_skills')
      .select('id')
      .order('installs', { ascending: false })
      .limit(100);

    if (!skills) return null;

    const rank = skills.findIndex(s => s.id === skillId) + 1;
    return rank > 0 ? rank : null;
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const skill = await getSkill(slug);

  if (!skill) {
    return { title: 'Skill Not Found' };
  }

  const title = `${skill.name} - Skills Hot`;
  const description = skill.description || `Install ${skill.name} skill for your AI coding agent`;
  const url = `https://skills.hot/${locale}/skills/${slug}`;

  // Get skill rank (only show for top 10)
  const rank = await getSkillRank(skill.id, skill.source);

  // Build OG image URL with stats
  const ogParams = new URLSearchParams({
    title: skill.name,
    subtitle: skill.description || '',
    type: 'skill',
    locale,
    installs: formatNumber(skill.installs),
    ...(skill.stars && { stars: formatNumber(skill.stars) }),
    ...(skill.author && { author: skill.author }),
    source: skill.source,
    ...(rank && rank <= 10 && { rank: rank.toString() }),
  });

  const ogUrl = `https://skills.hot/api/og?${ogParams.toString()}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        en: `/en/skills/${slug}`,
        zh: `/zh/skills/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Skills Hot',
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      images: [{
        url: ogUrl,
        width: 1200,
        height: 630,
        alt: title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl],
    },
  };
}

function generateSkillJsonLd(skill: SkillDetail, locale: string) {
  const url = `https://skills.hot/${locale}/skills/${skill.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: skill.name,
    description: skill.description || `AI coding agent skill: ${skill.name}`,
    url,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Cross-platform',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    ...(skill.author && {
      author: {
        '@type': 'Person',
        name: skill.author_info?.name || skill.author,
        url: `https://skills.hot/${locale}/authors/${skill.author}`,
      },
    }),
    ...(skill.installs && {
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/DownloadAction',
        userInteractionCount: skill.installs,
      },
    }),
    dateCreated: skill.created_at,
    dateModified: skill.updated_at || skill.created_at,
    ...(skill.repo && {
      codeRepository: `https://github.com/${skill.repo}`,
    }),
  };
}

export default async function SkillPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('skill');
  const skill = await getSkill(slug);

  if (!skill) {
    notFound();
  }

  const content = await getSkillContent(skill);

  // 使用数据库中存储的 repo_path 构建 GitHub URL
  const githubUrl = skill.repo
    ? `https://github.com/${skill.repo}${skill.repo_path ? `/tree/main/${skill.repo_path}` : ''}`
    : null;

  const jsonLd = generateSkillJsonLd(skill, locale);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-background">
      <SkillTracker skillSlug={skill.slug} />
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Breadcrumb */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {t('backToHome')}
        </Link>

        {/* Article layout */}
        <article className="mt-8 grid gap-12 lg:grid-cols-[1fr,280px]">
          {/* Main content */}
          <div>
            {/* Header */}
            <header className="mb-8">
              <p className="section-label mb-2">
                {skill.source === 'local' ? 'Platform' : skill.source === 'github' ? 'GitHub' : 'SkillSMP'}
              </p>
              <h1 className="text-3xl sm:text-4xl">{skill.name}</h1>
              {skill.description && (
                <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                  {skill.description}
                </p>
              )}

              {/* Byline */}
              <div className="byline mt-4 flex flex-wrap items-center gap-3">
                {skill.author && (
                  <Link
                    href={`/authors/${skill.author}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {skill.author}
                  </Link>
                )}
                <span>·</span>
                <span>{new Date(skill.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                {skill.version && (
                  <>
                    <span>·</span>
                    <span>v{skill.version}</span>
                  </>
                )}
              </div>
            </header>

            {/* Divider */}
            <div className="divider" />

            {/* Info notices */}
            {skill.source === 'github' && (
              <div className="my-6 text-sm text-muted-foreground">
                <Info className="mr-2 inline-block h-4 w-4" />
                {t('fromGitHub')}
                {githubUrl && (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-foreground underline underline-offset-2"
                  >
                    {skill.repo}
                  </a>
                )}
              </div>
            )}

            {skill.source === 'local' && skill.has_files && (
              <div className="my-6 text-sm text-muted-foreground">
                <Info className="mr-2 inline-block h-4 w-4" />
                {t('hasFiles')}
              </div>
            )}

            {/* Platforms */}
            {skill.platforms && skill.platforms.length > 0 && (
              <div className="my-6">
                <PlatformBadge platforms={skill.platforms} showLabel={true} />
              </div>
            )}

            {/* Tags */}
            {skill.tags && skill.tags.length > 0 && (
              <div className="my-6 flex flex-wrap gap-2">
                {skill.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="text-sm text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="my-8">
              <h2 className="mb-4 text-lg">SKILL.md</h2>
              {content ? (
                <div className="border border-border rounded-lg p-6 bg-card">
                  <MarkdownContent content={content} />
                </div>
              ) : (
                <p className="text-muted-foreground">{t('noContent')}</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            {/* Install */}
            <div>
              <h4 className="section-label mb-3">{t('install')}</h4>

              <div className="space-y-3">
                <div>
                  <p className="caption mb-1">Skills Hot CLI</p>
                  <div className="flex items-center justify-between gap-2 border-b border-border py-2">
                    <code className="truncate text-sm">skb add {skill.slug}</code>
                    <CopyButton text={`skb add ${skill.slug}`} skillSlug={skill.slug} />
                  </div>
                </div>

                <div>
                  <p className="caption mb-1">npx</p>
                  <div className="flex items-center justify-between gap-2 border-b border-border py-2">
                    <code className="truncate text-sm">npx @skills-hot/cli add {skill.slug}</code>
                    <CopyButton text={`npx @skills-hot/cli add ${skill.slug}`} skillSlug={skill.slug} />
                  </div>
                </div>

                {skill.source === 'local' && (
                  <div>
                    <p className="caption mb-1">{t('thirdParty.label')}</p>
                    <div className="flex items-center justify-between gap-2 border-b border-border py-2">
                      <code className="truncate text-sm text-muted-foreground">
                        {t('thirdParty.placeholder')}
                      </code>
                      <ThirdPartyCopyButton
                        skillSlug={skill.slug}
                        skillId={skill.id}
                        isPrivate={skill.is_private}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div>
              <h4 className="section-label mb-3">{t('statistics')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('installs')}</span>
                  <span>{skill.installs.toLocaleString()}</span>
                </div>
                {skill.stars !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('stars')}</span>
                    <span>{skill.stars.toLocaleString()}</span>
                  </div>
                )}
                <AuthStats views={skill.views} copies={skill.copies} />
              </div>
            </div>

            {/* Author */}
            {skill.author_info && (
              <div>
                <h4 className="section-label mb-3">Author</h4>
                <Link
                  href={`/authors/${skill.author_info.github_login}`}
                  className="flex items-center gap-3 transition-opacity hover:opacity-80"
                >
                  {skill.author_info.avatar_url && (
                    <img
                      src={skill.author_info.avatar_url}
                      alt={skill.author_info.name || skill.author_info.github_login}
                      className="h-10 w-10 rounded-full"
                    />
                  )}
                  <div>
                    <div className="text-sm">{skill.author_info.name || skill.author_info.github_login}</div>
                    <div className="text-xs text-muted-foreground">@{skill.author_info.github_login}</div>
                  </div>
                </Link>
              </div>
            )}

            {/* Links */}
            <div className="space-y-2">
              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Github className="h-4 w-4" />
                  {t('viewOnGitHub')}
                </a>
              )}

              {skill.source === 'local' && (
                <Link
                  href={`/api/skills/${skill.slug}/raw`}
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('viewSource')}
                </Link>
              )}
            </div>
          </aside>
        </article>
      </main>
      </div>
    </>
  );
}
