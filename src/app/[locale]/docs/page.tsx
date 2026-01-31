import { Header } from '@/components/Header';
import { CodeBlock } from '@/components/CodeBlock';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('seo.docs');
  const tSeo = await getTranslations('seo');

  const title = t('metaTitle');
  const description = t('metaDescription');

  return {
    title,
    description,
    alternates: {
      canonical: `https://skills.hot/${locale}/docs`,
      languages: {
        en: '/en/docs',
        zh: '/zh/docs',
      },
    },
    openGraph: {
      title,
      description,
      url: `https://skills.hot/${locale}/docs`,
      siteName: 'Skills Hot',
      type: 'article',
      locale: tSeo('locale'),
      images: [{
        url: `https://skills.hot/api/og?title=${encodeURIComponent(t('title'))}&subtitle=${encodeURIComponent(t('subtitle'))}&type=docs&locale=${locale}`,
        width: 1200,
        height: 630,
        alt: title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`https://skills.hot/api/og?title=${encodeURIComponent(t('title'))}&subtitle=${encodeURIComponent(t('subtitle'))}&type=docs&locale=${locale}`],
    },
  };
}

interface DocsJsonLdTranslations {
  fullTitle: string;
  jsonLdDescription: string;
  inLanguage: string;
  breadcrumb: string;
}

function generateDocsJsonLd(locale: string, t: DocsJsonLdTranslations) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: t.fullTitle,
    description: t.jsonLdDescription,
    url: `https://skills.hot/${locale}/docs`,
    inLanguage: t.inLanguage,
    isPartOf: {
      '@type': 'WebSite',
      '@id': 'https://skills.hot/#website',
      name: 'Skills Hot',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Skills Hot',
      url: 'https://skills.hot',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://skills.hot',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: t.breadcrumb,
          item: `https://skills.hot/${locale}/docs`,
        },
      ],
    },
    about: {
      '@type': 'SoftwareApplication',
      name: 'Skills Hot CLI',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'macOS, Linux, Windows',
    },
  };
}

export default async function DocsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('docs');
  const tSeo = await getTranslations('seo.docs');
  const tSeoRoot = await getTranslations('seo');

  const jsonLd = generateDocsJsonLd(locale, {
    fullTitle: tSeo('fullTitle'),
    jsonLdDescription: tSeo('jsonLdDescription'),
    inLanguage: tSeoRoot('inLanguage'),
    breadcrumb: tSeo('breadcrumb'),
  });

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Header */}
        <div className="mb-8">
          <p className="section-label mb-2">Reference</p>
          <h1 className="text-3xl sm:text-4xl">{t('title')}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* Divider */}
        <div className="divider-double" />

        {/* Getting Started */}
        <section className="py-8">
          <h2 className="mb-4 text-2xl">{t('gettingStarted')}</h2>
          <p className="mb-6 text-muted-foreground leading-relaxed">{t('gettingStartedDesc')}</p>

          {/* Installation */}
          <div>
            <h3 className="mb-2 text-lg">{t('installation')}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{t('installationDesc')}</p>
            <div className="space-y-4">
              <CodeBlock
                label="macOS / Linux / WSL"
                code="curl -fsSL https://skills.hot/install.sh | bash"
              />

              <CodeBlock
                label="Windows PowerShell"
                code="irm https://skills.hot/install.ps1 | iex"
              />

              <div className="divider my-4" />

              <CodeBlock
                label="Via npm"
                code="npm install -g @skills-hot/cli"
              />

              <CodeBlock
                label="Via npx (no install)"
                code="npx @skills-hot/cli <command>"
              />
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="divider" />

        {/* Commands */}
        <section className="py-8">
          <h2 className="mb-6 text-2xl">{t('commands')}</h2>

          <div className="space-y-8">
            <div>
              <h3 className="mb-2 text-lg">{t('addSkill')}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{t('addSkillDesc')}</p>
              <CodeBlock code="shot add <skill-name>" />
            </div>

            <div>
              <h3 className="mb-2 text-lg">{t('listSkills')}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{t('listSkillsDesc')}</p>
              <CodeBlock code="shot list" />
            </div>

            <div>
              <h3 className="mb-2 text-lg">{t('removeSkill')}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{t('removeSkillDesc')}</p>
              <CodeBlock code="shot remove <skill-name>" />
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="divider" />

        {/* SKILL.md Format */}
        <section className="py-8">
          <h2 className="mb-4 text-2xl">{t('skillFormat')}</h2>
          <p className="mb-4 text-muted-foreground leading-relaxed">{t('skillFormatDesc')}</p>
          <p className="text-sm text-muted-foreground">{t('skillFormatContent')}</p>
        </section>

        {/* Divider */}
        <div className="divider" />

        {/* API */}
        <section className="py-8">
          <h2 className="mb-4 text-2xl">{t('api')}</h2>
          <p className="mb-6 text-muted-foreground">{t('apiDesc')}</p>

          <h3 className="section-label mb-4">{t('endpoints')}</h3>
          <div className="space-y-0">
            <div className="border-b border-border py-4">
              <div className="mb-1 flex items-center gap-3">
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  GET
                </span>
                <code className="text-sm font-medium">/api/skills</code>
              </div>
              <p className="text-sm text-muted-foreground">List all skills</p>
            </div>

            <div className="border-b border-border py-4">
              <div className="mb-1 flex items-center gap-3">
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  GET
                </span>
                <code className="text-sm font-medium">/api/skills/:slug</code>
              </div>
              <p className="text-sm text-muted-foreground">Get a specific skill</p>
            </div>

            <div className="border-b border-border py-4">
              <div className="mb-1 flex items-center gap-3">
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  GET
                </span>
                <code className="text-sm font-medium">/api/skills/:slug/raw</code>
              </div>
              <p className="text-sm text-muted-foreground">Get SKILL.md content</p>
            </div>

            <div className="py-4">
              <div className="mb-1 flex items-center gap-3">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                  POST
                </span>
                <code className="text-sm font-medium">/api/stats</code>
              </div>
              <p className="text-sm text-muted-foreground">Report usage statistics</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
