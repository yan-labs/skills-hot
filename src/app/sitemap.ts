import { MetadataRoute } from 'next';

const BASE_URL = 'https://skills.hot';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ['en', 'zh'];

  // Static pages with their priorities and change frequencies
  const staticRoutes = [
    { route: '', changeFrequency: 'daily' as const, priority: 1 },
    { route: '/authors', changeFrequency: 'weekly' as const, priority: 0.8 },
    { route: '/docs', changeFrequency: 'monthly' as const, priority: 0.7 },
    { route: '/search', changeFrequency: 'weekly' as const, priority: 0.6 },
  ];

  const staticPages: MetadataRoute.Sitemap = staticRoutes.flatMap(({ route, changeFrequency, priority }) =>
    locales.map((locale) => ({
      url: `${BASE_URL}/${locale}${route}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
    }))
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Allow `next build` to succeed without Supabase env vars (e.g. CI, forks).
  // In that case, we return a sitemap with only the static routes.
  if (!supabaseUrl || !supabaseAnonKey) {
    return staticPages;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const [{ data: skills }, { data: authors }] = await Promise.all([
    supabase.from('skills').select('slug, updated_at').order('updated_at', { ascending: false }),
    supabase.from('authors').select('github_login, updated_at').order('total_installs', { ascending: false }),
  ]);

  // Dynamic skill pages
  const skillPages: MetadataRoute.Sitemap = (skills || []).flatMap((skill) =>
    locales.map((locale) => ({
      url: `${BASE_URL}/${locale}/skills/${skill.slug}`,
      lastModified: new Date(skill.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
  );

  // Dynamic author pages
  const authorPages: MetadataRoute.Sitemap = (authors || []).flatMap((author) =>
    locales.map((locale) => ({
      url: `${BASE_URL}/${locale}/authors/${author.github_login}`,
      lastModified: author.updated_at ? new Date(author.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))
  );

  return [...staticPages, ...skillPages, ...authorPages];
}
