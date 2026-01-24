import { supabase } from '@/lib/supabase';
import { Header } from '@/components/Header';
import { SearchBar } from '@/components/SearchBar';
import { SkillCard } from '@/components/SkillCard';
import { CodeBlock } from '@/components/CodeBlock';
import { ArrowRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

async function getPopularSkills() {
  const { data, error } = await supabase
    .from('skills')
    .select('*, skill_stats(*)')
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) {
    console.error('Error fetching skills:', error);
    return [];
  }

  return data || [];
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

      {/* Hero Section */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
          {t('hero.title1')}
          <br />
          <span className="text-muted-foreground">{t('hero.title2')}</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {t('hero.subtitle')}
        </p>

        {/* Search Bar */}
        <div className="mx-auto mt-10 max-w-xl">
          <SearchBar />
        </div>

        {/* Quick install */}
        <div className="mt-8 space-y-3">
          <div className="mx-auto max-w-lg">
            <CodeBlock code="curl -fsSL https://skillbank.kanchaishaoxia.workers.dev/install.sh | bash" />
          </div>
          <p className="text-xs text-muted-foreground">
            or via npm: <code className="rounded bg-muted px-1.5 py-0.5">npm i -g skillbank</code>
          </p>
        </div>
      </section>

      {/* Popular Skills */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t('popular.title')}</h2>
            <Link
              href="/skills"
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('popular.viewAll')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                name={skill.name}
                slug={skill.slug}
                description={skill.description}
                author={skill.author}
                category={skill.category}
                tags={skill.tags}
                installs={skill.skill_stats?.[0]?.installs || 0}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="font-medium">{t('features.cliFirst.title')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('features.cliFirst.description')}
              </p>
            </div>
            <div>
              <h3 className="font-medium">{t('features.openSecure.title')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('features.openSecure.description')}
              </p>
            </div>
            <div>
              <h3 className="font-medium">{t('features.universal.title')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('features.universal.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
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
        </div>
      </footer>
    </div>
  );
}
