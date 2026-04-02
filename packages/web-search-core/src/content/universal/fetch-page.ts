import type { Dispatcher } from 'undici';
import { DEFAULT_USER_AGENT } from '../../constants.js';
import { ProviderError, TimeoutError, WebSearchError } from '../../errors.js';

interface FetchOptions {
  signal: AbortSignal;
  redirect: 'follow';
  headers: Record<string, string>;
  dispatcher?: Dispatcher;
}

async function readResponseBody(
  response: Response,
): Promise<{ html: string; contentType: string }> {
  const contentType = response.headers.get('content-type') ?? 'text/html';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  const maxSize = 10 * 1024 * 1024;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalSize += value.byteLength;
    if (totalSize > maxSize) {
      reader.cancel();
      throw new Error(`Response too large (> ${maxSize} bytes)`);
    }
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  const html = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('');
  return { html, contentType };
}

export async function fetchPage(
  url: URL,
  timeoutMs: number,
  dispatcher?: Dispatcher,
): Promise<{ html: string; contentType: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const options: FetchOptions = {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    if (dispatcher) options.dispatcher = dispatcher;

    const response = await fetch(url.toString(), options as unknown as RequestInit);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    return await readResponseBody(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Page fetch timed out after ${timeoutMs}ms: ${url.toString()}`);
    }
    if (error instanceof WebSearchError) throw error;
    throw new ProviderError(
      `Failed to fetch ${url.toString()}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
