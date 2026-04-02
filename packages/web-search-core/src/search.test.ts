import { describe, expect, it } from 'vitest';
import type { SearchResult } from '../src/schemas.js';
import { normalizeUrl } from '../src/search/normalize.js';
import { rankResults } from '../src/search/rank.js';

describe('normalizeUrl', () => {
  it('removes www. prefix', () => {
    expect(normalizeUrl('https://www.example.com/page')).toBe('https://example.com/page');
  });

  it('lowercases hostname', () => {
    expect(normalizeUrl('https://Example.COM/path')).toBe('https://example.com/path');
  });

  it('removes trailing slash', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
  });

  it('preserves root trailing slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('removes utm_* tracking params', () => {
    const result = normalizeUrl('https://example.com/page?utm_source=google&utm_medium=cpc&id=1');
    expect(result).toBe('https://example.com/page?id=1');
  });

  it('removes fbclid param', () => {
    expect(normalizeUrl('https://example.com/page?fbclid=abc123')).toBe('https://example.com/page');
  });

  it('removes gclid param', () => {
    expect(normalizeUrl('https://example.com/page?gclid=abc123')).toBe('https://example.com/page');
  });

  it('removes ref and spm params', () => {
    expect(normalizeUrl('https://example.com/page?ref=sidebar&spm=a.b.c')).toBe(
      'https://example.com/page',
    );
  });

  it('removes fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('combines all normalizations', () => {
    expect(normalizeUrl('https://WWW.Example.COM/page/?utm_source=test&id=1#top')).toBe(
      'https://example.com/page?id=1',
    );
  });

  it('returns original for invalid URLs', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('rankResults', () => {
  const baseResult: SearchResult = {
    url: 'https://example.com',
    title: 'Example',
    source_providers: ['brave'],
    content_kind: 'unknown',
    fetch_status: 'not_requested',
  };

  it('boosts results with multiple providers', () => {
    const results: SearchResult[] = [
      { ...baseResult, url: 'https://single.com', source_providers: ['brave'] },
      {
        ...baseResult,
        url: 'https://multi.com',
        source_providers: ['brave', 'duckduckgo'],
      },
    ];
    const ranked = rankResults(results);
    expect(ranked[0]?.url).toBe('https://multi.com');
  });

  it('boosts trusted domains', () => {
    const results: SearchResult[] = [
      { ...baseResult, url: 'https://random-blog.com/page' },
      { ...baseResult, url: 'https://github.com/user/repo' },
    ];
    const ranked = rankResults(results);
    expect(ranked[0]?.url).toBe('https://github.com/user/repo');
  });

  it('boosts earlier positions', () => {
    const results: SearchResult[] = [
      { ...baseResult, url: 'https://first.com' },
      { ...baseResult, url: 'https://last.com' },
    ];
    const ranked = rankResults(results);
    expect(ranked[0]?.url).toBe('https://first.com');
  });

  it('handles empty results', () => {
    expect(rankResults([])).toEqual([]);
  });

  it('handles subdomains of trusted domains', () => {
    const results: SearchResult[] = [
      { ...baseResult, url: 'https://unknown.com/page' },
      { ...baseResult, url: 'https://docs.python.org/library' },
    ];
    const ranked = rankResults(results);
    expect(ranked[0]?.url).toBe('https://docs.python.org/library');
  });
});
