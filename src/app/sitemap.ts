import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const BASE_URL = 'https://skills.hot';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Get all skills for dynamic routes
  const { data: skills } = await supabase
    .from('skills')
    .select('slug, updated_at')
    .order('updated_at', { ascending: false });

  // Get all authors for dynamic routes
  const { data: authors } = await supabase
    .from('authors')
    .select('github_login, updated_at')
    .order('total_installs', { ascending: false });

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
