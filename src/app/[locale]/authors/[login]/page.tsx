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

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Breadcrumb */}
        <Link
          href="/skills"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to skills
        </Link>

        {/* Author Header */}
        <div className="mt-8 flex flex-col sm:flex-row items-start gap-6">
          {author.avatar_url && (
            <img
              src={author.avatar_url}
              alt={displayName}
              className="h-20 w-20 rounded-full"
            />
          )}
          <div className="flex-1">
            <p className="section-label mb-1">Author</p>
            <h1 className="text-3xl sm:text-4xl">{displayName}</h1>
            <p className="byline mt-2">@{author.github_login}</p>
            {author.bio && (
              <p className="mt-4 text-muted-foreground leading-relaxed">{author.bio}</p>
            )}

            {/* Stats */}
            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="font-medium">{author.external_skill_count + author.native_skill_count}</span>{' '}
                  <span className="text-muted-foreground">{t('skills')}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="font-medium">{author.total_installs.toLocaleString()}</span>{' '}
                  <span className="text-muted-foreground">{t('totalInstalls')}</span>
                </span>
              </div>
              <a
                href={`https://github.com/${author.github_login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="divider mt-8" />

        {/* Tabs */}
        <div className="flex gap-4 py-4">
          <Link
            href={`/authors/${login}`}
            className={`text-sm transition-colors ${
              tab === 'all'
                ? 'text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('tabs.all')} ({allSkills.length})
          </Link>
          <Link
            href={`/authors/${login}?tab=github`}
            className={`text-sm transition-colors ${
              tab === 'github'
                ? 'text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('tabs.github')} ({author.externalSkills.length})
          </Link>
          <Link
            href={`/authors/${login}?tab=platform`}
            className={`text-sm transition-colors ${
              tab === 'platform'
                ? 'text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('tabs.platform')} ({author.nativeSkills.length})
          </Link>
        </div>

        {/* Divider */}
        <div className="divider" />

        {/* Skills List */}
        {filteredSkills.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">{t('noSkills')}</p>
          </div>
        ) : (
          <div className="stagger">
            {filteredSkills.map((skill, index) => (
              <Link
                key={skill.id}
                href={`/skills/${skill.slug}`}
                className={`group block py-4 transition-colors hover:bg-muted/30 ${
                  index < filteredSkills.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg transition-colors group-hover:text-accent">
                        {skill.name}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {skill.skillType === 'platform' ? 'Platform' : 'GitHub'}
                      </span>
                    </div>
                    {skill.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {skill.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Download className="h-3 w-3" />
                    {skill.installs?.toLocaleString() || 0}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
