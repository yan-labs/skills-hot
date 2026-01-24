import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const BASE_URL = 'https://skillbank.kanchaishaoxia.workers.dev';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Get all skills for dynamic routes
  const { data: skills } = await supabase
    .from('skills')
    .select('slug, updated_at')
    .order('updated_at', { ascending: false });

  const locales = ['en', 'zh'];

  // Static pages
  const staticPages: MetadataRoute.Sitemap = ['', '/skills', '/search'].flatMap((route) =>
    locales.map((locale) => ({
      url: `${BASE_URL}/${locale}${route}`,
      lastModified: new Date(),
      changeFrequency: (route === '' ? 'daily' : 'weekly') as 'daily' | 'weekly',
      priority: route === '' ? 1 : 0.8,
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

  return [...staticPages, ...skillPages];
}
