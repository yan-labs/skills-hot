import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/Header';
import { notFound } from 'next/navigation';
import { ExternalLink, ArrowLeft, Github, Star, Download, Info } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { CopyButton } from '@/components/CopyButton';
import { SkillTracker } from '@/components/SkillTracker';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchGitHubContent, getGitHubRawUrl, parseTopSource } from '@/lib/github-content';
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

  // 1. Try local skills table first
  const { data: localSkill } = await supabase
    .from('skills')
    .select('*, skill_stats(installs, views), author:authors(*)')
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
      source: 'local',
      contentSource: 'database',
      installs: localSkill.skill_stats?.installs || 0,
      views: localSkill.skill_stats?.views || 0,
      version: localSkill.version,
      has_files: localSkill.has_files,
      is_private: localSkill.is_private,
      author_info: localSkill.author || null,
      created_at: localSkill.created_at,
      updated_at: localSkill.updated_at,
    };
  }

  // 2. Try external_skills table
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

  // 3. Try by name in external_skills
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

  // GitHub content
  if (skill.raw_url) {
    return await fetchGitHubContent(skill.raw_url);
  }

  if (skill.repo) {
    const { owner, repo } = parseTopSource(skill.repo);
    const rawUrl = getGitHubRawUrl(owner, repo, 'main', skill.repo_path);
    return await fetchGitHubContent(rawUrl);
  }

  return '';
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const skill = await getSkill(slug);

  if (!skill) {
    return { title: 'Skill Not Found' };
  }

  return {
    title: `${skill.name} - SkillBank`,
    description: skill.description || `Install ${skill.name} skill for your AI coding agent`,
    alternates: {
      canonical: `https://skillbank.dev/${locale}/skills/${slug}`,
      languages: {
        en: `/en/skills/${slug}`,
        zh: `/zh/skills/${slug}`,
      },
    },
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
  const githubUrl = skill.repo ? `https://github.com/${skill.repo}${skill.repo_path ? `/tree/main/${skill.repo_path}` : ''}` : null;

  return (
    <div className="min-h-screen bg-background">
      <SkillTracker skillSlug={skill.slug} skillId={skill.id} />
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Breadcrumb */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToSkills')}
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Header */}
            <div className="mb-8">
              <div className="mb-2 flex items-center gap-3">
                <h1 className="text-2xl font-semibold sm:text-3xl">{skill.name}</h1>
                {/* Source Badge */}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  skill.source === 'local'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : skill.source === 'github'
                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}>
                  {t(`source.${skill.source}`)}
                </span>
              </div>
              <p className="text-base text-muted-foreground sm:text-lg">{skill.description}</p>

              {/* Meta */}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {skill.author && (
                  <Link
                    href={`/authors/${skill.author}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {skill.author}
                  </Link>
                )}
                <span>{new Date(skill.created_at).toLocaleDateString(locale)}</span>
                {skill.version && <span>v{skill.version}</span>}
              </div>
            </div>

            {/* Source Info Banner */}
            {skill.source === 'github' && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-foreground">{t('fromGitHub')}</p>
                  {githubUrl && (
                    <a
                      href={githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Github className="h-4 w-4" />
                      {skill.repo}
                    </a>
                  )}
                </div>
              </div>
            )}

            {skill.source === 'local' && skill.has_files && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
                <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{t('hasFiles')}</p>
              </div>
            )}

            {/* Tags */}
            {skill.tags && skill.tags.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-2">
                {skill.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="rounded-md bg-secondary px-2.5 py-0.5 text-sm text-secondary-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="rounded-lg border border-border p-4 sm:p-6">
              <h2 className="mb-4 font-medium">{t('content')}</h2>
              <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs sm:p-4 sm:text-sm">
                {content || t('noContent')}
              </pre>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Install Card */}
            <div className="rounded-lg border border-border p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">{t('install')}</h3>

              {/* CLI Command */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                  <code className="min-w-0 truncate text-xs sm:text-sm">skillbank add {skill.slug}</code>
                  <CopyButton text={`skillbank add ${skill.slug}`} skillSlug={skill.slug} skillId={skill.id} />
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                  <code className="min-w-0 truncate text-xs sm:text-sm">npx skillbank add {skill.slug}</code>
                  <CopyButton text={`npx skillbank add ${skill.slug}`} skillSlug={skill.slug} skillId={skill.id} />
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div className="rounded-lg border border-border p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">{t('statistics')}</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Download className="h-4 w-4" />
                    {t('installs')}
                  </span>
                  <span className="font-medium">{skill.installs.toLocaleString()}</span>
                </div>
                {skill.stars !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Star className="h-4 w-4" />
                      {t('stars')}
                    </span>
                    <span className="font-medium">{skill.stars.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Author Card */}
            {skill.author_info && (
              <div className="rounded-lg border border-border p-4 sm:p-6">
                <Link
                  href={`/authors/${skill.author_info.github_login}`}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  {skill.author_info.avatar_url && (
                    <img
                      src={skill.author_info.avatar_url}
                      alt={skill.author_info.name || skill.author_info.github_login}
                      className="h-10 w-10 rounded-full"
                    />
                  )}
                  <div>
                    <div className="font-medium">{skill.author_info.name || skill.author_info.github_login}</div>
                    <div className="text-sm text-muted-foreground">@{skill.author_info.github_login}</div>
                  </div>
                </Link>
              </div>
            )}

            {/* GitHub Link */}
            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-muted"
              >
                <Github className="h-4 w-4" />
                {t('viewOnGitHub')}
              </a>
            )}

            {/* Source Link for local skills */}
            {skill.source === 'local' && (
              <Link
                href={`/api/skills/${skill.slug}/raw`}
                className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" />
                {t('viewSource')}
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
