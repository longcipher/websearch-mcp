import type { Dispatcher } from 'undici';
import type { Config } from '../config.js';
import type { SearchResult } from '../schemas.js';
import { getDispatcherForUrl } from '../security/proxy-agent.js';
import { normalizeUrl } from './normalize.js';
import { braveSearch } from './providers/brave.js';
import { duckduckgoSearch } from './providers/duckduckgo.js';
import { createSearxngProvider } from './providers/searxng.js';
import { createSerperProvider } from './providers/serper.js';
import { createTavilyProvider } from './providers/tavily.js';
import { rankResults } from './rank.js';

type ProviderFn = (
  query: string,
  numResults: number,
  timeoutMs: number,
  dispatcher?: Dispatcher,
) => Promise<SearchResult[]>;

interface ProviderEntry {
  name: string;
  fn: ProviderFn;
  enabled: boolean;
}

function getProviders(config: Config): ProviderEntry[] {
  const providers: ProviderEntry[] = [
    { name: 'brave', fn: braveSearch, enabled: true },
    { name: 'duckduckgo', fn: duckduckgoSearch, enabled: true },
  ];

  if (config.serperApiKey) {
    providers.push({
      name: 'serper',
      fn: createSerperProvider(config.serperApiKey),
      enabled: true,
    });
  }
  if (config.tavilyApiKey) {
    providers.push({
      name: 'tavily',
      fn: createTavilyProvider(config.tavilyApiKey),
      enabled: true,
    });
  }
  if (config.searxngBaseUrl) {
    providers.push({
      name: 'searxng',
      fn: createSearxngProvider(config.searxngBaseUrl),
      enabled: true,
    });
  }

  return providers;
}

function mergeResults(results: SearchResult[]): SearchResult[] {
  const deduped = new Map<string, SearchResult>();
  for (const result of results) {
    const normalized = normalizeUrl(result.url);
    const existing = deduped.get(normalized);
    if (existing) {
      for (const provider of result.source_providers) {
        if (!existing.source_providers.includes(provider)) {
          existing.source_providers.push(provider);
        }
      }
    } else {
      deduped.set(normalized, { ...result, url: normalized });
    }
  }
  return Array.from(deduped.values());
}

export async function aggregateSearch(
  query: string,
  numResults: number,
  config: Config,
): Promise<SearchResult[]> {
  const totalController = new AbortController();
  const totalTimeoutId = setTimeout(() => totalController.abort(), config.searchTotalTimeoutMs);

  try {
    const providers = getProviders(config).filter((p) => p.enabled);
    const dispatcher = getDispatcherForUrl(config, 'https://example.com');

    const settled = await Promise.allSettled(
      providers.map((p) => p.fn(query, numResults, config.searchTimeoutMs, dispatcher)),
    );

    const allResults: SearchResult[] = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') allResults.push(...outcome.value);
    }

    return rankResults(mergeResults(allResults)).slice(0, numResults);
  } finally {
    clearTimeout(totalTimeoutId);
  }
}
