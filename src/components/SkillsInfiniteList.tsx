'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, Loader2, Download, Star, Package } from 'lucide-react';
import { SkillCard } from '@/components/SkillCard';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import type { Platform } from '@/lib/supabase';

type SearchType = 'skills' | 'authors' | 'repos';

type SkillResult = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  author: string | null;
  category: string | null;
  tags: string[] | null;
  platforms: string[] | null;
  installs: number;
  source: 'local' | 'external';
};

type AuthorResult = {
  id: string;
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  external_skill_count: number;
  total_installs: number;
  total_stars: number;
};

type RepoResult = {
  repo: string;
  skill_count: number;
  total_installs: number;
  skills: { name: string; slug: string }[];
};

type ApiResponse = {
  type: SearchType;
  results: SkillResult[] | AuthorResult[] | RepoResult[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export function SkillsInfiniteList() {
  const t = useTranslations('search');
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const platform = searchParams.get('platform') || '';
  const searchType = (searchParams.get('type') as SearchType) || 'skills';

  const [results, setResults] = useState<(SkillResult | AuthorResult | RepoResult)[]>([]);
  const [resultType, setResultType] = useState<SearchType>('skills');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Fetch results
  const fetchResults = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (platform && searchType === 'skills') params.set('platform', platform);
      if (searchType !== 'skills') params.set('type', searchType);
      params.set('page', pageNum.toString());

      const response = await fetch(`/api/skills/search?${params.toString()}`);
      const data: ApiResponse = await response.json();

      if (reset) {
        setResults(data.results);
      } else {
        setResults(prev => [...prev, ...data.results]);
      }

      setResultType(data.type);
      setHasMore(data.hasMore);
      setTotal(data.total);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [query, platform, searchType]);

  // Reset and fetch when search params change
  useEffect(() => {
    setResults([]);
    setPage(1);
    setHasMore(true);
    fetchResults(1, true);
  }, [query, platform, searchType, fetchResults]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchResults(page + 1, false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadingMore, page, fetchResults]);

  // Initial loading state
  if (loading) {
    return (
      <div className="py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // No results (only when searching)
  if (results.length === 0 && query) {
    return (
      <div className="py-8">
        <div className="py-16 text-center">
          <Search className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
          <h3 className="text-lg">{t('noResults')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('noResultsHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Results count or hot skills header */}
      {query ? (
        <p className="byline mb-6">
          {t('results', { count: total, query })}
        </p>
      ) : resultType === 'skills' ? (
        <div className="mb-6">
          <p className="byline">{t('hotSkills')}</p>
          <p className="text-xs text-muted-foreground">{t('hotSkillsHint')}</p>
        </div>
      ) : null}

      {/* Results list */}
      <div className="stagger">
        {resultType === 'skills' && (results as SkillResult[]).map((skill, index) => (
          <div
            key={`${skill.source}-${skill.id}`}
            className={index < results.length - 1 ? 'border-b border-border' : ''}
          >
            <SkillCard
              name={skill.name}
              slug={skill.slug}
              description={skill.description}
              author={skill.author}
              category={skill.category}
              tags={skill.tags}
              platforms={skill.platforms as Platform[] | null}
              installs={skill.installs}
            />
          </div>
        ))}

        {resultType === 'authors' && (results as AuthorResult[]).map((author, index) => (
          <Link
            key={author.id}
            href={`/authors/${author.github_login}`}
            className={`group flex items-center gap-4 py-4 transition-colors ${
              index < results.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            {author.avatar_url ? (
              <Image
                src={author.avatar_url}
                alt={author.name || author.github_login}
                width={48}
                height={48}
                unoptimized
                className="rounded-full"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-medium">
                {author.github_login[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-medium group-hover:underline">
                {author.name || author.github_login}
              </h3>
              <p className="text-sm text-muted-foreground">@{author.github_login}</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                {author.external_skill_count}
              </span>
              <span className="flex items-center gap-1">
                <Download className="h-4 w-4" />
                {author.total_installs.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4" />
                {author.total_stars.toLocaleString()}
              </span>
            </div>
          </Link>
        ))}

        {resultType === 'repos' && (results as RepoResult[]).map((repo, index) => (
          <a
            key={repo.repo}
            href={`https://github.com/${repo.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`group block py-4 transition-colors ${
              index < results.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium group-hover:underline">{repo.repo}</h3>
                <div className="mt-1 flex flex-wrap gap-2">
                  {repo.skills.map((skill) => (
                    <span
                      key={skill.slug}
                      className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {skill.name}
                    </span>
                  ))}
                  {repo.skill_count > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{repo.skill_count - 3} more
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {repo.skill_count}
                </span>
                <span className="flex items-center gap-1">
                  <Download className="h-4 w-4" />
                  {repo.total_installs.toLocaleString()}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="py-8">
        {loadingMore && (
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
