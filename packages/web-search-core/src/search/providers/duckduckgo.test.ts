import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, TimeoutError } from '../../errors.js';
import { duckduckgoSearch } from './duckduckgo.js';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('duckduckgoSearch', () => {
  const ddgHtml = `
    <html>
      <body>
        <div class="results">
          <div class="result results_links results_links_deep">
            <div class="result__body">
              <a class="result__a" href="https://example.com/page1">Example Page 1</a>
              <div class="result__snippet">This is a description of page one.</div>
            </div>
          </div>
          <div class="result results_links results_links_deep">
            <div class="result__body">
              <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fpage2">Example Page 2</a>
              <div class="result__snippet">Another description here.</div>
            </div>
          </div>
          <div class="result results_links results_links_deep">
            <div class="result__body">
              <a class="result__a" href="https://example.net/page3">Example Page 3</a>
              <div class="result__snippet">Third result description.</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const ddgHtmlWithRedirectUrls = `
    <html>
      <body>
        <div class="results">
          <div class="result results_links results_links_deep">
            <div class="result__body">
              <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage1">Example Page 1</a>
              <div class="result__snippet">This is a description of page one.</div>
            </div>
          </div>
          <div class="result results_links results_links_deep">
            <div class="result__body">
              <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fpage2">Example Page 2</a>
              <div class="result__snippet">Another description here.</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const emptyHtml = `<html><body><p>No results found.</p></body></html>`;

  it('parses valid DuckDuckGo HTML search results', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(ddgHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const results = await duckduckgoSearch('test query', 10, 5000);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.url).toBe('https://example.com/page1');
    expect(results[0]?.title).toBe('Example Page 1');
    expect(results[0]?.summary).toBe('This is a description of page one.');
    expect(results[0]?.source_providers).toEqual(['duckduckgo']);
  });

  it('extracts actual URLs from DuckDuckGo redirect links', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(ddgHtmlWithRedirectUrls, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const results = await duckduckgoSearch('test query', 10, 5000);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.url).toBe('https://example.com/page1');
    expect(results[1]?.url).toBe('https://example.org/page2');
  });

  it('limits results to numResults', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(ddgHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const results = await duckduckgoSearch('test query', 2, 5000);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array when no results found', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(emptyHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const results = await duckduckgoSearch('nonexistent query xyz', 10, 5000);
    expect(results).toEqual([]);
  });

  it('handles network errors gracefully', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    await expect(duckduckgoSearch('test', 10, 5000)).rejects.toThrow(ProviderError);
  });

  it('handles HTTP error status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Service Unavailable', {
        status: 503,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(duckduckgoSearch('test', 10, 5000)).rejects.toThrow(ProviderError);
  });

  it('handles timeout via AbortController', async () => {
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      const signal = (init as RequestInit)?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    await expect(duckduckgoSearch('test', 10, 10)).rejects.toThrow(TimeoutError);
  }, 10000);

  it('encodes query parameter correctly', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(emptyHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await duckduckgoSearch('hello world test', 5, 5000);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=hello%20world%20test'),
      expect.any(Object),
    );
  });

  it('encodes special characters in query', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(emptyHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await duckduckgoSearch('what is C++?', 5, 5000);

    const callArgs = vi.mocked(fetch).mock.calls[0];
    expect(callArgs?.[0]).toContain('q=');
  });

  it('sends correct headers', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(emptyHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await duckduckgoSearch('test', 5, 5000);

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const options = callArgs?.[1] as RequestInit;
    expect(options?.headers).toMatchObject({
      'User-Agent': expect.stringContaining('Mozilla'),
      Accept: expect.stringContaining('text/html'),
    });
  });

  it('uses fallback link extraction when no structured results', async () => {
    const fallbackHtml = `
      <html>
        <body>
          <header>Navigation</header>
          <main>
            <div class="fallback-result">
              <a href="https://example.com/result">Example Result Title Here</a>
            </div>
            <div class="fallback-result">
              <a href="https://example.org/another">Another Result Title Here</a>
            </div>
          </main>
          <footer>Footer</footer>
        </body>
      </html>
    `;

    vi.mocked(fetch).mockResolvedValue(
      new Response(fallbackHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const results = await duckduckgoSearch('test', 10, 5000);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.url).toBe('https://example.com/result');
  });
});
