import { Header } from '@/components/Header';
import { CodeBlock } from '@/components/CodeBlock';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DocsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('docs');

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="mb-2 text-2xl font-semibold sm:text-3xl">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* Getting Started */}
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold">{t('gettingStarted')}</h2>
          <p className="mb-6 text-muted-foreground">{t('gettingStartedDesc')}</p>

          {/* Installation */}
          <div className="mb-6">
            <h3 className="mb-2 font-medium">{t('installation')}</h3>
            <p className="mb-3 text-sm text-muted-foreground">{t('installationDesc')}</p>
            <div className="space-y-4">
              {/* Quick Install */}
              <CodeBlock
                label="macOS / Linux / WSL"
                code="curl -fsSL https://skillbank.kanchaishaoxia.workers.dev/install.sh | bash"
              />

              <CodeBlock
                label="Windows PowerShell"
                code="irm https://skillbank.kanchaishaoxia.workers.dev/install.ps1 | iex"
              />

              <div className="border-t border-border pt-4">
                <CodeBlock
                  label="Via npm"
                  code="npm install -g skillbank"
                />
              </div>

              <CodeBlock
                label="Via npx (no install)"
                code="npx skillbank <command>"
              />
            </div>
          </div>
        </section>

        {/* Commands */}
        <section className="mb-12">
          <h2 className="mb-6 text-xl font-semibold">{t('commands')}</h2>

          <div className="space-y-6">
            {/* Add */}
            <div>
              <h3 className="mb-2 font-medium">{t('addSkill')}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{t('addSkillDesc')}</p>
              <CodeBlock code="skillbank add <skill-name>" />
            </div>

            {/* List */}
            <div>
              <h3 className="mb-2 font-medium">{t('listSkills')}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{t('listSkillsDesc')}</p>
              <CodeBlock code="skillbank list" />
            </div>

            {/* Remove */}
            <div>
              <h3 className="mb-2 font-medium">{t('removeSkill')}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{t('removeSkillDesc')}</p>
              <CodeBlock code="skillbank remove <skill-name>" />
            </div>
          </div>
        </section>

        {/* SKILL.md Format */}
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold">{t('skillFormat')}</h2>
          <p className="mb-4 text-muted-foreground">{t('skillFormatDesc')}</p>
          <p className="text-sm text-muted-foreground">{t('skillFormatContent')}</p>
        </section>

        {/* API */}
        <section>
          <h2 className="mb-4 text-xl font-semibold">{t('api')}</h2>
          <p className="mb-6 text-muted-foreground">{t('apiDesc')}</p>

          <h3 className="mb-3 font-medium">{t('endpoints')}</h3>
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                  GET
                </span>
                <code className="text-sm">/api/skills</code>
              </div>
              <p className="text-sm text-muted-foreground">List all skills</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                  GET
                </span>
                <code className="text-sm">/api/skills/:slug</code>
              </div>
              <p className="text-sm text-muted-foreground">Get a specific skill</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                  GET
                </span>
                <code className="text-sm">/api/skills/:slug/raw</code>
              </div>
              <p className="text-sm text-muted-foreground">Get SKILL.md content</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  POST
                </span>
                <code className="text-sm">/api/stats</code>
              </div>
              <p className="text-sm text-muted-foreground">Report usage statistics</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
