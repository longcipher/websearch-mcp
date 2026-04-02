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

interface TavilyResponse {
  results?: Array<{ url: string; title: string; content?: string }>;
}

function parseTavilyResults(data: TavilyResponse, numResults: number): SearchResult[] {
  if (!data.results || !Array.isArray(data.results)) return [];

  const results: SearchResult[] = [];
  for (const item of data.results) {
    if (results.length >= numResults) break;
    results.push({
      url: normalizeUrl(item.url),
      title: item.title ?? '',
      summary: item.content ?? undefined,
      source_providers: ['tavily'],
      content_kind: 'unknown',
      fetch_status: 'not_requested',
    });
  }
  return results;
}

export function createTavilyProvider(apiKey: string): ProviderFn {
  return async function tavilySearch(
    query: string,
    numResults: number,
    timeoutMs: number,
    dispatcher?: Dispatcher,
  ): Promise<SearchResult[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchOptions: {
        method: 'POST';
        signal: AbortSignal;
        headers: Record<string, string>;
        body: string;
        dispatcher?: Dispatcher;
      } = {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, api_key: apiKey, max_results: numResults }),
      };
      if (dispatcher) fetchOptions.dispatcher = dispatcher;

      const response = await fetch(
        'https://api.tavily.com/search',
        fetchOptions as unknown as RequestInit,
      );
      if (!response.ok) throw new ProviderError(`Tavily search returned ${response.status}`);

      const data = (await response.json()) as TavilyResponse;
      return parseTavilyResults(data, numResults);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Tavily search timed out after ${timeoutMs}ms`);
      }
      if (error instanceof TimeoutError || error instanceof ProviderError) throw error;
      throw new ProviderError(`Tavily search failed: ${String(error)}`, { cause: error });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}
