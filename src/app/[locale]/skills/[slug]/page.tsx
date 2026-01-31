import { Header } from '@/components/Header';
import { notFound } from 'next/navigation';
import { ExternalLink, ArrowLeft, Github, Star, Download, Info } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { CopyButton } from '@/components/CopyButton';
import { ThirdPartyCopyButton } from '@/components/ThirdPartyCopyButton';
import { SkillTracker } from '@/components/SkillTracker';
import { PlatformBadge } from '@/components/PlatformBadge';
import { MarkdownContent } from '@/components/MarkdownContent';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchGitHubContent, fetchSkillContent, getGitHubRawUrl, parseTopSource } from '@/lib/github-content';
import type { SkillDetail } from '@/lib/supabase';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

async function getSkill(slug: string): Promise<SkillDetail | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Skip during build time when env vars are not available
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const { createClient } = await import('@supabase/supabase-js');
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

  // 查询 external_skills，优先取 skills.sh 来源（有实时 installs 数据）
  // 使用 order + limit 避免重复记录导致 .single() 失败
  const { data: externalSkills } = await supabase
    .from('external_skills')
    .select('*, author:authors(*)')
    .eq('slug', slug)
    .order('source', { ascending: false }) // skills.sh > github
    .limit(1);

  const externalSkill = externalSkills?.[0];

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

  // 备选：按 name 查询，同样处理重复记录
  const { data: externalByNames } = await supabase
    .from('external_skills')
    .select('*, author:authors(*)')
    .eq('name', slug)
    .order('source', { ascending: false })
    .limit(1);

  const externalByName = externalByNames?.[0];

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
    const { createClient } = await import('@supabase/supabase-js');
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

  const { createClient } = await import('@supabase/supabase-js');
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

  // During build time on Cloudflare Pages, env vars may not be available
  // Return a generic metadata and let the page handle 404 at runtime
  if (process.env.CF_PAGES) {
    return {
      title: `${slug} - Skills Hot`,
      description: `AI coding agent skill: ${slug}`,
    };
  }

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
  // repo_path 为 null 表示 SKILL.md 在根目录
  const githubUrl = skill.repo
    ? `https://github.com/${skill.repo}${skill.repo_path ? `/tree/main/${skill.repo_path}` : ''}`
    : null;

  const jsonLd = generateSkillJsonLd(skill, locale);

  // Generate avatar URL for author
  const authorAvatarUrl = skill.author_info?.avatar_url ||
    (skill.author ? `https://github.com/${skill.author}.png?size=80` : null);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-background">
      <SkillTracker skillSlug={skill.slug} />
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Breadcrumb */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {t('backToHome')}
        </Link>

        {/* True left-right layout */}
        <article className="mt-6 flex flex-col gap-6 md:flex-row md:gap-8">
          {/* LEFT: Markdown content area */}
          <div className="min-w-0 flex-1 order-2 md:order-1">
            {/* Content header */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                SKILL.md
              </span>
              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Github className="h-3.5 w-3.5" />
                  View source
                </a>
              )}
            </div>

            {/* Markdown content */}
            {content ? (
              <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm sm:p-8">
                <MarkdownContent content={content} />
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
                <p className="text-muted-foreground">{t('noContent')}</p>
              </div>
            )}
          </div>

          {/* RIGHT: Info sidebar */}
          <aside className="order-1 w-full flex-shrink-0 md:order-2 md:sticky md:top-20 md:w-[380px] md:self-start">
            <div className="rounded-xl border border-border/50 bg-card">
              {/* Header section */}
              <div className="p-5">
                {/* Source + Platforms */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    {skill.source === 'local' ? 'Platform' : skill.source === 'github' ? 'GitHub' : 'SkillSMP'}
                  </span>
                  {skill.platforms && skill.platforms.length > 0 && (
                    <PlatformBadge platforms={skill.platforms} showLabel={false} />
                  )}
                </div>

                {/* Title */}
                <h1 className="text-2xl font-semibold leading-tight">{skill.name}</h1>

                {/* Description */}
                {skill.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {skill.description}
                  </p>
                )}

                {/* Author */}
                <Link
                  href={skill.author ? `/authors/${skill.author}` : '#'}
                  className="group mt-4 flex items-center gap-3"
                >
                  {authorAvatarUrl && (
                    <img
                      src={authorAvatarUrl}
                      alt={skill.author_info?.name || skill.author || 'Author'}
                      className="h-10 w-10 rounded-full transition-transform group-hover:scale-105"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {skill.author && (
                      <span className="flex items-center gap-1 text-sm font-medium group-hover:underline">
                        {skill.author_info?.name || skill.author}
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{new Date(skill.created_at).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      {skill.version && (
                        <>
                          <span>·</span>
                          <span>v{skill.version}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Tags */}
                {skill.tags && skill.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {skill.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats section */}
              <div className="border-t border-border/50 px-5 py-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="font-semibold tabular-nums">{skill.installs.toLocaleString()}</span>
                      <span className="ml-1.5 text-muted-foreground">{t('installs')}</span>
                    </div>
                    {skill.stars !== undefined && (
                      <div>
                        <span className="font-semibold tabular-nums">{skill.stars.toLocaleString()}</span>
                        <span className="ml-1.5 text-muted-foreground">{t('stars')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {skill.views !== undefined && skill.views > 0 && (
                      <span>{skill.views.toLocaleString()} views</span>
                    )}
                    {skill.copies !== undefined && skill.copies > 0 && (
                      <span>{skill.copies.toLocaleString()} copies</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Install section */}
              <div className="border-t border-border/50 px-5 py-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('install')}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                    <code className="truncate text-sm">skb add {skill.slug}</code>
                    <CopyButton text={`skb add ${skill.slug}`} skillSlug={skill.slug} />
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                    <code className="truncate text-xs">npx @skills-hot/cli add {skill.slug}</code>
                    <CopyButton text={`npx @skills-hot/cli add ${skill.slug}`} skillSlug={skill.slug} />
                  </div>
                  {skill.source === 'local' && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                      <code className="truncate text-xs text-muted-foreground">
                        {t('thirdParty.placeholder')}
                      </code>
                      <ThirdPartyCopyButton
                        skillSlug={skill.slug}
                        skillId={skill.id}
                        isPrivate={skill.is_private}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Info notice for local skills with files */}
              {skill.source === 'local' && skill.has_files && (
                <div className="border-t border-border/50 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Info className="h-4 w-4 text-amber-500" />
                    <span className="text-muted-foreground">{t('hasFiles')}</span>
                  </div>
                </div>
              )}

              {/* Links */}
              {(githubUrl || skill.source === 'local') && (
                <div className="flex gap-2 border-t border-border/50 p-4">
                  {githubUrl && (
                    <a
                      href={githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm transition-colors hover:bg-muted/70"
                    >
                      <Github className="h-4 w-4" />
                      GitHub
                    </a>
                  )}
                  {skill.source === 'local' && (
                    <Link
                      href={`/api/skills/${skill.slug}/raw`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm transition-colors hover:bg-muted/70"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t('viewSource')}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </aside>
        </article>
      </main>
      </div>
    </>
  );
}
