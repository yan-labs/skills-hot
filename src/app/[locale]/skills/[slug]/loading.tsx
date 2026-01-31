import { Header } from '@/components/Header';

export default function SkillLoading() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Breadcrumb skeleton */}
        <div className="mb-8 h-4 w-24 animate-pulse rounded bg-muted" />

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Header skeleton */}
            <div className="mb-8">
              <div className="mb-2 h-8 w-48 animate-pulse rounded bg-muted" />
              <div className="h-5 w-full animate-pulse rounded bg-muted" />
              <div className="mt-4 flex gap-4">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            </div>

            {/* Tags skeleton */}
            <div className="mb-8 flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-6 w-16 animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>

            {/* Content skeleton */}
            <div className="rounded-lg border border-border p-6">
              <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-48 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Install Card skeleton */}
            <div className="rounded-lg border border-border p-6">
              <div className="mb-4 h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="space-y-3">
                <div className="h-10 animate-pulse rounded-lg bg-muted" />
                <div className="h-10 animate-pulse rounded-lg bg-muted" />
              </div>
            </div>

            {/* Stats Card skeleton */}
            <div className="rounded-lg border border-border p-6">
              <div className="mb-4 h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="h-6 w-12 animate-pulse rounded bg-muted" />
                  <div className="mt-1 h-3 w-16 animate-pulse rounded bg-muted" />
                </div>
                <div>
                  <div className="h-6 w-12 animate-pulse rounded bg-muted" />
                  <div className="mt-1 h-3 w-16 animate-pulse rounded bg-muted" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
