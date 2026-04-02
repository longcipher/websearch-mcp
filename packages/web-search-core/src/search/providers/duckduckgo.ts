import * as cheerio from 'cheerio';
import type { Dispatcher } from 'undici';
import { DEFAULT_USER_AGENT } from '../../constants.js';
import { ProviderError, TimeoutError } from '../../errors.js';
import type { SearchResult } from '../../schemas.js';
import { normalizeUrl } from '../normalize.js';

function extractFallbackLinks(
  $: cheerio.CheerioAPI,
  results: SearchResult[],
  numResults: number,
): void {
  $('[class*="result"] a[href^="http"]').each((_index, element) => {
    if (results.length >= numResults) return;
    const $el = $(element);
    const href = $el.attr('href');
    const title = $el.text().trim();

    if (
      href &&
      title &&
      title.length >= 5 &&
      !href.includes('duckduckgo.com') &&
      !$el.closest('header, nav, footer, .nav, .footer').length
    ) {
      const actualUrl = extractDuckduckgoUrl(href);
      const normalizedUrl = normalizeUrl(actualUrl);
      const existing = results.find((r) => r.url === normalizedUrl);
      if (!existing) {
        results.push({
          url: normalizedUrl,
          title,
          source_providers: ['duckduckgo'],
          content_kind: 'unknown',
          fetch_status: 'not_requested',
        });
      }
    }
  });
}

function extractDuckduckgoUrl(href: string): string {
  try {
    const parsed = new URL(href);
    if (parsed.searchParams.has('uddg')) {
      return parsed.searchParams.get('uddg') ?? href;
    }
  } catch {
    // keep original href
  }
  return href;
}

export async function duckduckgoSearch(
  query: string,
  numResults: number,
  timeoutMs: number,
  dispatcher?: Dispatcher,
): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const fetchOptions: {
      signal: AbortSignal;
      headers: Record<string, string>;
      dispatcher?: Dispatcher;
    } = {
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
    }
    const response = await fetch(searchUrl, fetchOptions as unknown as RequestInit);

    if (!response.ok) {
      throw new ProviderError(`DuckDuckGo search returned ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('div.result, div.results_links, div.links_main').each((_index, element) => {
      if (results.length >= numResults) return;

      const $el = $(element);
      const linkEl = $el.find('a.result__a, a.result__url, h2 a').first();
      const href = linkEl.attr('href');
      const title = linkEl.text().trim();
      const summary = $el
        .find('a.result__snippet, div.result__snippet, .result-snippet')
        .text()
        .trim();

      if (href && title) {
        const actualUrl = extractDuckduckgoUrl(href);
        const normalizedUrl = normalizeUrl(actualUrl);
        results.push({
          url: normalizedUrl,
          title,
          summary: summary || undefined,
          source_providers: ['duckduckgo'],
          content_kind: 'unknown',
          fetch_status: 'not_requested',
        });
      }
    });

    if (results.length === 0) {
      extractFallbackLinks($, results, numResults);
    }

    return results;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`DuckDuckGo search timed out after ${timeoutMs}ms`);
    }
    if (error instanceof TimeoutError || error instanceof ProviderError) throw error;
    throw new ProviderError(`DuckDuckGo search failed: ${String(error)}`, { cause: error });
  } finally {
    clearTimeout(timeoutId);
  }
}
