import { Header } from '@/components/Header';

export default function SkillsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Header skeleton */}
        <div className="mb-10">
          <div className="mb-2 h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-5 w-64 animate-pulse rounded bg-muted" />
        </div>

        {/* Search bar skeleton */}
        <div className="mb-10 max-w-xl">
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        </div>

        {/* Skills grid skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border p-4"
            >
              <div className="mb-2 h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="mb-4 h-4 w-full animate-pulse rounded bg-muted" />
              <div className="flex justify-between">
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                <div className="h-3 w-12 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
