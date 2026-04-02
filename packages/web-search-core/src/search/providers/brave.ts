import * as cheerio from 'cheerio';
import type { Dispatcher } from 'undici';
import { DEFAULT_USER_AGENT } from '../../constants.js';
import { ProviderError, TimeoutError } from '../../errors.js';
import type { SearchResult } from '../../schemas.js';
import { normalizeUrl } from '../normalize.js';

export async function braveSearch(
  query: string,
  numResults: number,
  timeoutMs: number,
  dispatcher?: Dispatcher,
): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
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
      throw new ProviderError(`Brave search returned ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('div.snippet').each((_index, element) => {
      if (results.length >= numResults) return;

      const $el = $(element);
      const linkEl = $el.find('a').first();
      const href = linkEl.attr('href');
      const title = linkEl.find('.snippet-title, .title').text().trim() || linkEl.text().trim();
      const summary = $el.find('.snippet-description, .snippet-content').text().trim();

      if (href && title) {
        const normalizedUrl = normalizeUrl(href);
        results.push({
          url: normalizedUrl,
          title,
          summary: summary || undefined,
          source_providers: ['brave'],
          content_kind: 'unknown',
          fetch_status: 'not_requested',
        });
      }
    });

    if (results.length === 0) {
      $('[class*="card"] a[href^="http"], [class*="result"] a[href^="http"]').each(
        (_index, element) => {
          if (results.length >= numResults) return;
          const $el = $(element);
          const href = $el.attr('href');
          const title = $el.text().trim();

          if (
            href &&
            title &&
            title.length >= 5 &&
            !href.includes('brave.com') &&
            !$el.closest('header, nav, footer').length
          ) {
            const normalizedUrl = normalizeUrl(href);
            const existing = results.find((r) => r.url === normalizedUrl);
            if (!existing) {
              results.push({
                url: normalizedUrl,
                title,
                source_providers: ['brave'],
                content_kind: 'unknown',
                fetch_status: 'not_requested',
              });
            }
          }
        },
      );
    }

    return results;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Brave search timed out after ${timeoutMs}ms`);
    }
    if (error instanceof TimeoutError || error instanceof ProviderError) throw error;
    throw new ProviderError(`Brave search failed: ${String(error)}`, { cause: error });
  } finally {
    clearTimeout(timeoutId);
  }
}
