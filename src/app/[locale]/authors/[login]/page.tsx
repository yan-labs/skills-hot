import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/Header';
import { notFound } from 'next/navigation';
import { ArrowLeft, Github, Download, Package } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Author, ExternalSkill, SkillV2 } from '@/lib/supabase';

type Props = {
  params: Promise<{ locale: string; login: string }>;
  searchParams: Promise<{ tab?: string }>;
};

interface AuthorWithSkills extends Author {
  externalSkills: ExternalSkill[];
  nativeSkills: SkillV2[];
}

async function getAuthorByLogin(login: string): Promise<AuthorWithSkills | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get author
  const { data: author, error } = await supabase
    .from('authors')
    .select('*')
    .eq('github_login', login)
    .single();

  if (error || !author) {
    return null;
  }

  // Get external skills
  const { data: externalSkills } = await supabase
    .from('external_skills')
    .select('*')
    .eq('author_id', author.id)
    .order('installs', { ascending: false });

  // Get native skills (public only)
  const { data: nativeSkills } = await supabase
    .from('skills')
    .select('*')
    .eq('author_id', author.id)
    .eq('is_private', false);

  return {
    ...author,
    externalSkills: externalSkills || [],
    nativeSkills: nativeSkills || [],
  };
}

export async function generateMetadata({ params }: Props) {
  const { locale, login } = await params;
  const author = await getAuthorByLogin(login);

  if (!author) {
    return { title: 'Author Not Found' };
  }

  const name = author.name || author.github_login;

  return {
    title: `${name} - SkillBank`,
    description: author.bio || `Skills by ${name} on SkillBank`,
    alternates: {
      canonical: `https://skillbank.dev/${locale}/authors/${login}`,
      languages: {
        en: `/en/authors/${login}`,
        zh: `/zh/authors/${login}`,
      },
    },
  };
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { locale, login } = await params;
  const { tab = 'all' } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('author');
  const author = await getAuthorByLogin(login);

  if (!author) {
    notFound();
  }

  const allSkills = [
    ...author.nativeSkills.map(s => ({ ...s, skillType: 'platform' as const })),
    ...author.externalSkills.map(s => ({ ...s, skillType: 'github' as const })),
  ];

  const filteredSkills =
    tab === 'github'
      ? author.externalSkills.map(s => ({ ...s, skillType: 'github' as const }))
      : tab === 'platform'
      ? author.nativeSkills.map(s => ({ ...s, skillType: 'platform' as const }))
      : allSkills;

  const displayName = author.name || author.github_login;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Breadcrumb */}
        <Link
          href="/skills"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('skills')}
        </Link>

        {/* Author Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {author.avatar_url && (
            <img
              src={author.avatar_url}
              alt={displayName}
              className="h-24 w-24 rounded-full"
            />
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-semibold sm:text-3xl">{displayName}</h1>
            <p className="mt-1 text-muted-foreground">@{author.github_login}</p>
            {author.bio && (
              <p className="mt-3 text-sm text-muted-foreground">{author.bio}</p>
            )}

            {/* Stats */}
            <div className="mt-4 flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">{author.external_skill_count + author.native_skill_count}</span>{' '}
                  {t('skills')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">{author.total_installs.toLocaleString()}</span>{' '}
                  {t('totalInstalls')}
                </span>
              </div>
            </div>

            {/* GitHub Link */}
            <a
              href={`https://github.com/${author.github_login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Github className="h-4 w-4" />
              {t('viewOnGitHub')}
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-border">
          <Link
            href={`/authors/${login}`}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'all'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('tabs.all')} ({allSkills.length})
          </Link>
          <Link
            href={`/authors/${login}?tab=github`}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'github'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('tabs.github')} ({author.externalSkills.length})
          </Link>
          <Link
            href={`/authors/${login}?tab=platform`}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'platform'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('tabs.platform')} ({author.nativeSkills.length})
          </Link>
        </div>

        {/* Skills Grid */}
        {filteredSkills.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {t('noSkills')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSkills.map(skill => (
              <Link
                key={skill.id}
                href={`/skills/${skill.slug}`}
                className="group rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-medium group-hover:text-primary transition-colors">
                    {skill.name}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      skill.skillType === 'platform'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {skill.skillType === 'platform' ? t('platformSkills') : t('githubSkills')}
                  </span>
                </div>
                {skill.description && (
                  <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                    {skill.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Download className="h-3 w-3" />
                  {skill.installs?.toLocaleString() || 0}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
