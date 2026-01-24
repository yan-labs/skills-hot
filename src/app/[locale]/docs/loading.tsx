import { Header } from '@/components/Header';

export default function DocsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Header skeleton */}
        <div className="mb-12">
          <div className="mb-2 h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-5 w-56 animate-pulse rounded bg-muted" />
        </div>

        {/* Section skeleton */}
        <div className="mb-12">
          <div className="mb-4 h-6 w-36 animate-pulse rounded bg-muted" />
          <div className="mb-6 h-4 w-full animate-pulse rounded bg-muted" />

          <div className="mb-6">
            <div className="mb-2 h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="mb-3 h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-12 animate-pulse rounded-lg bg-muted" />
              <div className="h-12 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        </div>

        {/* Commands section skeleton */}
        <div className="mb-12">
          <div className="mb-6 h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <div className="mb-2 h-5 w-28 animate-pulse rounded bg-muted" />
                <div className="mb-3 h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
