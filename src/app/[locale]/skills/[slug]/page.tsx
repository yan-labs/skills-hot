import { Header } from '@/components/Header';
import { notFound } from 'next/navigation';
import { ExternalLink, ArrowLeft, ArrowUpRight, Download, Info } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { CopyButton } from '@/components/CopyButton';
import { SkillTracker } from '@/components/SkillTracker';
import { PlatformBadge } from '@/components/PlatformBadge';
import { MarkdownContent } from '@/components/MarkdownContent';
import { SkillFiles } from '@/components/SkillFiles';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchGitHubContent, fetchSkillContent, getGitHubRawUrl, parseTopSource, fetchGitHubDirectory } from '@/lib/github-content';
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

type AuthorSkill = {
  name: string;
  slug: string;
  description: string | null;
  installs: number;
};

async function getAuthorOtherSkills(
  authorLogin: string | null,
  currentSkillSlug: string
): Promise<{ totalCount: number; skills: AuthorSkill[] }> {
  if (!authorLogin) return { totalCount: 0, skills: [] };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) return { totalCount: 0, skills: [] };

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 获取作者的所有技能（排除当前技能，最多显示6个）
  const { data: skills, count } = await supabase
    .from('external_skills')
    .select('name, slug, description, installs', { count: 'exact' })
    .ilike('github_owner', authorLogin)
    .neq('slug', currentSkillSlug)
    .order('installs', { ascending: false })
    .limit(6);

  return {
    totalCount: (count || 0) + 1, // +1 包含当前技能
    skills: (skills || []).map(s => ({
      name: s.name,
      slug: s.slug,
      description: s.description,
      installs: s.installs,
    })),
  };
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

type FileItem = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
};

type SkillFilesResult = {
  files: FileItem[];
  resolvedPath: string | null;  // 实际找到文件的路径
};

async function getSkillFiles(skill: SkillDetail): Promise<SkillFilesResult> {
  // 只对 GitHub 来源的 skills 获取文件列表
  if (!skill.repo) {
    return { files: [], resolvedPath: null };
  }

  const { owner, repo } = parseTopSource(skill.repo);

  // 尝试多种可能的路径
  const possiblePaths: (string | null)[] = [];

  // 从 skillName 中移除可能的前缀（如 vercel-react-best-practices -> react-best-practices）
  const ownerFirstPart = owner.split('-')[0];
  const strippedName = skill.name
    .replace(new RegExp(`^${owner}-`, 'i'), '')
    .replace(new RegExp(`^${ownerFirstPart}-`, 'i'), '')
    .replace(new RegExp(`^${repo}-`, 'i'), '');

  // 1. 优先尝试去除前缀的名称
  if (strippedName !== skill.name) {
    possiblePaths.push(`skills/${strippedName}`);
  }

  // 2. 使用 repo_path（如果有）
  if (skill.repo_path) {
    possiblePaths.push(`skills/${skill.repo_path}`);
    possiblePaths.push(skill.repo_path);
  }

  // 3. 尝试 skills/{name}
  possiblePaths.push(`skills/${skill.name}`);

  // 4. 尝试根目录
  possiblePaths.push(null);

  for (const path of possiblePaths) {
    const files = await fetchGitHubDirectory(owner, repo, path);
    // 如果找到了 SKILL.md，说明找对了目录
    if (files.some(f => f.name === 'SKILL.md')) {
      return {
        files: files.map(f => ({
          name: f.name,
          path: f.path,
          type: f.type as 'file' | 'dir',
          download_url: f.download_url,
        })),
        resolvedPath: path,
      };
    }
  }

  return { files: [], resolvedPath: null };
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const tSeo = await getTranslations('seo');

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
  const ogLocale = tSeo('locale');

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
      locale: ogLocale,
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

  const [content, authorData, skillFilesResult] = await Promise.all([
    getSkillContent(skill),
    getAuthorOtherSkills(skill.author, slug),
    getSkillFiles(skill),
  ]);

  const { files: skillFiles, resolvedPath } = skillFilesResult;

  // 使用实际找到文件的路径构建 GitHub URL
  const githubUrl = skill.repo
    ? `https://github.com/${skill.repo}${resolvedPath ? `/tree/main/${resolvedPath}` : ''}`
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

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
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
              <div className="px-5 py-0">
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
                      <span>{authorData.totalCount} {authorData.totalCount === 1 ? 'skill' : 'skills'}</span>
                    </div>
                  </div>
                </Link>

                {/* Platforms */}
                {skill.platforms && skill.platforms.length > 0 && (
                  <div className="mt-4 -mx-5 bg-black">
                    <PlatformBadge platforms={skill.platforms} showLabel={false} size="lg" scrollable />
                  </div>
                )}

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

              {/* Install section with stats */}
              <div className="border-t border-border/50 px-5 py-4">
                {/* Stats inline with title */}
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('install')}</h4>
                  <div className="flex items-center gap-3 text-xs">
                    <span>
                      <span className="font-semibold tabular-nums">{skill.installs.toLocaleString()}</span>
                      <span className="ml-1 text-muted-foreground">{t('installs')}</span>
                    </span>
                    {skill.stars !== undefined && skill.stars > 0 && (
                      <span>
                        <span className="font-semibold tabular-nums">{skill.stars.toLocaleString()}</span>
                        <span className="ml-1 text-muted-foreground">{t('stars')}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                  <code className="truncate text-sm">npx skills add {skill.name}</code>
                  <CopyButton text={`npx skills add ${skill.name}`} skillSlug={skill.slug} />
                </div>
              </div>

              {/* Skill files - 项目文件结构 */}
              {skillFiles.length > 0 && (
                <div className="border-t border-border/50">
                  <SkillFiles files={skillFiles} githubUrl={githubUrl} />
                </div>
              )}

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
              {skill.source === 'local' && (
                <div className="flex gap-2 border-t border-border/50 p-4">
                  <Link
                    href={`/api/skills/${skill.slug}/raw`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm transition-colors hover:bg-muted/70"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('viewSource')}
                  </Link>
                </div>
              )}
            </div>

            {/* Author's other skills - 单独区域 */}
            {authorData.skills.length > 0 && (
              <div className="mt-4 rounded-xl border border-border/50 bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('moreFromAuthor')}
                  </h4>
                  <Link
                    href={`/authors/${skill.author}`}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t('viewAllFromAuthor')} →
                  </Link>
                </div>
                <div className="space-y-2">
                  {authorData.skills.map((s) => (
                    <Link
                      key={s.slug}
                      href={`/skills/${s.slug}`}
                      className="group/item flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted"
                    >
                      <span className="truncate text-sm group-hover/item:underline">{s.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Download className="h-3 w-3" />
                        {s.installs.toLocaleString()}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </article>
      </main>
      </div>
    </>
  );
}
