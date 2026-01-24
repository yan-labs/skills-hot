import { supabase } from '@/lib/supabase';
import { Header } from '@/components/Header';
import { notFound } from 'next/navigation';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { CopyButton } from '@/components/CopyButton';
import { SkillTracker } from '@/components/SkillTracker';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

async function getSkill(slug: string) {
  const { data, error } = await supabase
    .from('skills')
    .select('*, skill_stats(*)')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
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
      canonical: `https://skillbank.kanchaishaoxia.workers.dev/${locale}/skills/${slug}`,
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
              <h1 className="mb-2 text-2xl font-semibold sm:text-3xl">{skill.name}</h1>
              <p className="text-base text-muted-foreground sm:text-lg">{skill.description}</p>

              {/* Meta */}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {skill.author && <span>{skill.author}</span>}
                <span>{new Date(skill.created_at).toLocaleDateString(locale)}</span>
              </div>
            </div>

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
                {skill.content || t('noContent')}
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

            {/* Source Link */}
            {skill.source_url && (
              <a
                href={skill.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" />
                {t('viewSource')}
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
