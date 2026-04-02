import type { Dispatcher } from 'undici';
import { ProviderError, TimeoutError } from '../../errors.js';
import type { SearchResult } from '../../schemas.js';
import { normalizeUrl } from '../normalize.js';

type ProviderFn = (
  query: string,
  numResults: number,
  timeoutMs: number,
  dispatcher?: Dispatcher,
) => Promise<SearchResult[]>;

interface SearxngResponse {
  results?: Array<{ url: string; title: string; content?: string }>;
}

function parseSearxngResults(data: SearxngResponse, numResults: number): SearchResult[] {
  if (!data.results || !Array.isArray(data.results)) return [];

  const results: SearchResult[] = [];
  for (const item of data.results) {
    if (results.length >= numResults) break;
    results.push({
      url: normalizeUrl(item.url),
      title: item.title ?? '',
      summary: item.content ?? undefined,
      source_providers: ['searxng'],
      content_kind: 'unknown',
      fetch_status: 'not_requested',
    });
  }
  return results;
}

export function createSearxngProvider(baseUrl: string): ProviderFn {
  return async function searxngSearch(
    query: string,
    numResults: number,
    timeoutMs: number,
    dispatcher?: Dispatcher,
  ): Promise<SearchResult[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const searchUrl = `${baseUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}&format=json`;
      const fetchOptions: {
        signal: AbortSignal;
        headers: Record<string, string>;
        dispatcher?: Dispatcher;
      } = {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      };
      if (dispatcher) fetchOptions.dispatcher = dispatcher;

      const response = await fetch(searchUrl, fetchOptions as unknown as RequestInit);
      if (!response.ok) throw new ProviderError(`SearXNG search returned ${response.status}`);

      const data = (await response.json()) as SearxngResponse;
      return parseSearxngResults(data, numResults);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`SearXNG search timed out after ${timeoutMs}ms`);
      }
      if (error instanceof TimeoutError || error instanceof ProviderError) throw error;
      throw new ProviderError(`SearXNG search failed: ${String(error)}`, { cause: error });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}
