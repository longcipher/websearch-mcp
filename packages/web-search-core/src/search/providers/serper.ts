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

interface SerperResponse {
  organic?: Array<{ link: string; title: string; snippet?: string }>;
}

function parseSerperResults(data: SerperResponse, numResults: number): SearchResult[] {
  if (!data.organic || !Array.isArray(data.organic)) return [];

  const results: SearchResult[] = [];
  for (const item of data.organic) {
    if (results.length >= numResults) break;
    results.push({
      url: normalizeUrl(item.link),
      title: item.title ?? '',
      summary: item.snippet ?? undefined,
      source_providers: ['serper'],
      content_kind: 'unknown',
      fetch_status: 'not_requested',
    });
  }
  return results;
}

export function createSerperProvider(apiKey: string): ProviderFn {
  return async function serperSearch(
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
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: numResults }),
      };
      if (dispatcher) fetchOptions.dispatcher = dispatcher;

      const response = await fetch(
        'https://google.serper.dev/search',
        fetchOptions as unknown as RequestInit,
      );
      if (!response.ok) throw new ProviderError(`Serper search returned ${response.status}`);

      const data = (await response.json()) as SerperResponse;
      return parseSerperResults(data, numResults);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Serper search timed out after ${timeoutMs}ms`);
      }
      if (error instanceof TimeoutError || error instanceof ProviderError) throw error;
      throw new ProviderError(`Serper search failed: ${String(error)}`, { cause: error });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}
