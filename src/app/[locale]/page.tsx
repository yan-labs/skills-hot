import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/Header';
import { SearchBar } from '@/components/SearchBar';
import { SkillCard } from '@/components/SkillCard';
import { CodeBlock } from '@/components/CodeBlock';
import { ArrowRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

async function getPopularSkills() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get public skills from our platform
  const { data: localSkills, error: localError } = await supabase
    .from('skills')
    .select('*, skill_stats(installs)')
    .eq('is_private', false)
    .order('created_at', { ascending: false })
    .limit(6);

  if (localError) {
    console.error('Error fetching local skills:', localError);
  }

  // If we have local skills, return them
  if (localSkills && localSkills.length > 0) {
    return localSkills;
  }

  // Otherwise, get featured skills from skills.sh cache
  const { data: featuredSkills, error: featuredError } = await supabase
    .from('skills_sh_cache')
    .select('name, installs, top_source')
    .order('installs', { ascending: false })
    .limit(6);

  if (featuredError) {
    console.error('Error fetching featured skills:', featuredError);
    return [];
  }

  // Transform to match the expected shape
  return (featuredSkills || []).map((skill) => ({
    id: skill.name,
    name: skill.name,
    slug: skill.name,
    description: null,
    author: skill.top_source?.split('/')[0] || null,
    category: null,
    tags: null,
    skill_stats: [{ installs: skill.installs }],
    source: 'skills.sh',
  }));
}

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const skills = await getPopularSkills();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero Section - Editorial style */}
        <section className="py-16 sm:py-24">
          {/* Section label */}
          <p className="section-label mb-4">AI Agent Skills Marketplace</p>

          {/* Main headline - large serif */}
          <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl">
            {t('hero.title1')}{' '}
            <span className="text-muted-foreground">{t('hero.title2')}</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            {t('hero.subtitle')}
          </p>

          {/* Search */}
          <div className="mt-10 max-w-md">
            <SearchBar />
          </div>

          {/* Install command - terminal style */}
          <div className="mt-8">
            <p className="byline mb-2">Quick install</p>
            <div className="inline-block">
              <CodeBlock code="npm i -g skillbank" />
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="divider-double" />

        {/* Popular Skills */}
        <section className="py-12">
          <div className="mb-8 flex items-baseline justify-between">
            <div>
              <p className="section-label mb-1">Featured</p>
              <h2 className="text-2xl sm:text-3xl">{t('popular.title')}</h2>
            </div>
            <Link
              href="/skills"
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('popular.viewAll')}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Skills grid with dividers */}
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill, index) => (
              <div
                key={skill.id}
                className={`${
                  index % 3 !== 2 ? 'lg:border-r lg:border-border lg:pr-6' : ''
                } ${
                  index % 2 !== 1 ? 'sm:border-r sm:border-border sm:pr-6 lg:border-r-0 lg:pr-0' : ''
                } ${
                  index % 3 === 1 ? 'lg:px-6' : ''
                } ${
                  index % 2 === 1 ? 'sm:pl-6 lg:pl-0' : ''
                } ${
                  index % 3 === 2 ? 'lg:pl-6' : ''
                } ${
                  index < skills.length - 3 ? 'border-b border-border lg:border-b' : ''
                } ${
                  index < skills.length - 2 ? 'sm:border-b' : 'sm:border-b-0'
                } ${
                  index < skills.length - 1 ? 'border-b sm:border-b-0' : 'border-b-0'
                }`}
              >
                <SkillCard
                  name={skill.name}
                  slug={skill.slug}
                  description={skill.description}
                  author={skill.author}
                  category={skill.category}
                  tags={skill.tags}
                  installs={skill.skill_stats?.[0]?.installs || 0}
                  source={skill.source}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="divider" />

        {/* Features - simple text layout */}
        <section className="py-12">
          <p className="section-label mb-6">Why SkillBank</p>

          <div className="grid gap-8 sm:grid-cols-3 sm:gap-12">
            <div>
              <h3 className="text-lg">{t('features.cliFirst.title')}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {t('features.cliFirst.description')}
              </p>
            </div>
            <div>
              <h3 className="text-lg">{t('features.openSecure.title')}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {t('features.openSecure.description')}
              </p>
            </div>
            <div>
              <h3 className="text-lg">{t('features.universal.title')}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
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
            <p className="text-sm text-muted-foreground">
              {t('footer.copyright')}
            </p>
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
