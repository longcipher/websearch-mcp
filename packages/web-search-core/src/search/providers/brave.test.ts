import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, TimeoutError } from '../../errors.js';
import { braveSearch } from './brave.js';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('braveSearch', () => {
  const braveHtml = `
    <html>
      <body>
        <div class="snippets">
          <div class="snippet">
            <a href="https://example.com/page1">
              <strong class="snippet-title">Example Page 1</strong>
            </a>
            <div class="snippet-description">This is a description of page one.</div>
          </div>
          <div class="snippet">
            <a href="https://example.org/page2">
              <strong class="snippet-title">Example Page 2</strong>
            </a>
            <div class="snippet-description">Another description here.</div>
          </div>
          <div class="snippet">
            <a href="https://example.net/page3">
              <strong class="snippet-title">Example Page 3</strong>
            </a>
            <div class="snippet-description">Third result description.</div>
          </div>
        </div>
      </body>
    </html>
  `;

  const emptyHtml = `<html><body><p>No results found.</p></body></html>`;

  it('parses valid Brave HTML search results', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(braveHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const results = await braveSearch('test query', 10, 5000);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.url).toBe('https://example.com/page1');
    expect(results[0]?.title).toBe('Example Page 1');
    expect(results[0]?.summary).toBe('This is a description of page one.');
    expect(results[0]?.source_providers).toEqual(['brave']);
  });

  it('limits results to numResults', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(braveHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const results = await braveSearch('test query', 2, 5000);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array when no results found', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(emptyHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const results = await braveSearch('nonexistent query xyz', 10, 5000);
    expect(results).toEqual([]);
  });

  it('handles network errors gracefully', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    await expect(braveSearch('test', 10, 5000)).rejects.toThrow(ProviderError);
  });

  it('handles HTTP error status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Not Found', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(braveSearch('test', 10, 5000)).rejects.toThrow(ProviderError);
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

    await expect(braveSearch('test', 10, 10)).rejects.toThrow(TimeoutError);
  }, 10000);

  it('encodes query parameter correctly', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(emptyHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await braveSearch('hello world test', 5, 5000);

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

    await braveSearch('what is C++?', 5, 5000);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('q='), expect.any(Object));
    const callArgs = vi.mocked(fetch).mock.calls[0];
    expect(callArgs?.[0]).toContain('what%20is%20C%2B%2B%3F');
  });

  it('sends correct headers', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(emptyHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await braveSearch('test', 5, 5000);

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const options = callArgs?.[1] as RequestInit;
    expect(options?.headers).toMatchObject({
      'User-Agent': expect.stringContaining('Mozilla'),
      Accept: expect.stringContaining('text/html'),
    });
  });

  it('uses fallback link extraction when no snippet results', async () => {
    const fallbackHtml = `
      <html>
        <body>
          <header>Nav links</header>
          <main>
            <div class="search-result">
              <a href="https://example.com/result">Example Result Title</a>
            </div>
            <div class="search-result">
              <a href="https://example.org/another">Another Result Title</a>
            </div>
          </main>
          <footer>Footer link</footer>
        </body>
      </html>
    `;

    vi.mocked(fetch).mockResolvedValue(
      new Response(fallbackHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const results = await braveSearch('test', 10, 5000);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.url).toBe('https://example.com/result');
  });
});
