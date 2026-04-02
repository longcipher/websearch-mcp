import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { After, Before, Given, Then, When } from '@cucumber/cucumber';
import type {
  Config,
  FetchResponse,
  SearchResponse,
} from '../../packages/web-search-core/src/index.js';

let config: Config;
let lastSearchResult: SearchResponse | undefined;
let lastFetchResult: FetchResponse | undefined;
let testServer: Server | undefined;
let testServerPort: number;

function makeTestConfig(overrides: Partial<Config> = {}): Config {
  return {
    serperApiKey: undefined,
    tavilyApiKey: undefined,
    searxngBaseUrl: undefined,
    githubToken: undefined,
    httpProxy: undefined,
    httpsProxy: undefined,
    searchTimeoutMs: 10000,
    fetchTimeoutMs: 15000,
    searchTotalTimeoutMs: 30000,
    searchMaxConcurrency: 3,
    searchMaxResults: 10,
    fetchMaxChars: 50000,
    allowPrivateNetworkFetch: false,
    logLevel: 'error' as const,
    ...overrides,
  };
}

function startTestServer(): Promise<number> {
  return new Promise((resolve) => {
    const html = `<!DOCTYPE html>
<html><head><title>Test Page</title></head>
<body>
  <main>
    <article>
      <h1>Test Article</h1>
      <p>This is a test page for web_fetch BDD testing.</p>
      <pre><code>const x = 42;</code></pre>
    </article>
  </main>
</body></html>`;

    testServer = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });

    testServer.listen(0, '127.0.0.1', () => {
      const addr = testServer?.address();
      if (addr && typeof addr === 'object') {
        resolve(addr.port);
      }
    });
  });
}

Before(async () => {
  config = makeTestConfig();
  lastSearchResult = undefined;
  lastFetchResult = undefined;
  testServerPort = await startTestServer();
});

After(() => {
  lastSearchResult = undefined;
  lastFetchResult = undefined;
  if (testServer) {
    testServer.close();
    testServer = undefined;
  }
});

Given('the web search MCP server is running', () => {
  assert.ok(config, 'Config should be initialized');
});

Given('the web search MCP server is running with a very short timeout', () => {
  config = makeTestConfig({
    searchTimeoutMs: 1,
    fetchTimeoutMs: 1,
    searchTotalTimeoutMs: 1,
  });
});

When('I call the {string} tool with query {string}', async (_toolName: string, query: string) => {
  const { aggregateSearch } = await import(
    '../../packages/web-search-core/src/search/aggregate.js'
  );
  const results = await aggregateSearch(query, config.searchMaxResults, config);
  lastSearchResult = {
    query,
    num_results: results.length,
    results,
  };
});

When(
  'I call the {string} tool with query {string} and include_page_content true',
  async (_toolName: string, query: string) => {
    const { aggregateSearch } = await import(
      '../../packages/web-search-core/src/search/aggregate.js'
    );
    const results = await aggregateSearch(query, config.searchMaxResults, config);
    lastSearchResult = {
      query,
      num_results: results.length,
      results,
    };
  },
);

When(
  'I call the {string} tool with query {string} and num_results {int}',
  async (_toolName: string, query: string, numResults: number) => {
    const { aggregateSearch } = await import(
      '../../packages/web-search-core/src/search/aggregate.js'
    );
    const results = await aggregateSearch(query, numResults, config);
    lastSearchResult = {
      query,
      num_results: results.length,
      results,
    };
  },
);

When('I call the {string} tool with url {string}', async (_toolName: string, url: string) => {
  const actualUrl = url === 'https://example.com' ? `http://127.0.0.1:${testServerPort}` : url;

  try {
    const { ContentResolverChain } = await import(
      '../../packages/web-search-core/src/content/resolve.js'
    );
    const chain = new ContentResolverChain();
    const resolved = await chain.resolve(new URL(actualUrl), {
      timeoutMs: config.fetchTimeoutMs,
      maxChars: config.fetchMaxChars,
    });
    if (resolved) {
      lastFetchResult = {
        url: actualUrl,
        content_kind: resolved.content_kind,
        fetch_status: 'ok',
        content_length: resolved.content.length,
        content: resolved.content,
      };
    } else {
      lastFetchResult = {
        url: actualUrl,
        content_kind: 'unknown',
        fetch_status: 'error',
        content_length: 0,
        content: `Failed to retrieve page content: no resolver could handle URL ${actualUrl}`,
      };
    }
  } catch (err) {
    lastFetchResult = {
      url: actualUrl,
      content_kind: 'unknown',
      fetch_status: 'error',
      content_length: 0,
      content: `Failed to retrieve page content: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
});

function getToolResult(): Record<string, unknown> {
  if (lastSearchResult) return lastSearchResult as unknown as Record<string, unknown>;
  if (lastFetchResult) return lastFetchResult as unknown as Record<string, unknown>;
  throw new Error('No tool result available');
}

Then('the response should contain a {string} array', (field: string) => {
  const result = getToolResult();
  assert.ok(Array.isArray(result[field]), `Expected ${field} to be an array`);
});

Then('each result should have a {string} and {string} field', (field1: string, field2: string) => {
  const result = getToolResult();
  const results = result.results as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(results), 'Expected results array');
  for (const item of results) {
    assert.ok(item[field1] !== undefined, `Expected ${field1} in result`);
    assert.ok(item[field2] !== undefined, `Expected ${field2} in result`);
  }
});

Then('the top results should have a {string} field', (field: string) => {
  const result = getToolResult();
  const results = result.results as Array<Record<string, unknown>>;
  const enriched = results.filter((r) => r[field] !== undefined);
  assert.ok(enriched.length > 0, `Expected at least one result with ${field}`);
});

Then('the {string} should be {string} for enriched results', (field: string, value: string) => {
  const result = getToolResult();
  const results = result.results as Array<Record<string, unknown>>;
  const enriched = results.filter((r) => r.page_content !== undefined);
  for (const item of enriched) {
    assert.equal(item[field], value, `Expected ${field} to be ${value}`);
  }
});

Then('the response should contain at most {int} results', (max: number) => {
  const result = getToolResult();
  const results = result.results as Array<unknown>;
  assert.ok(results.length <= max, `Expected at most ${max} results, got ${results.length}`);
});

Then(
  'the response should contain results with {string} set to {string}',
  (field: string, value: string) => {
    const result = getToolResult();
    const results = result.results as Array<Record<string, unknown>>;
    const matching = results.filter((r) => r[field] === value);
    assert.ok(matching.length > 0, `Expected at least one result with ${field}=${value}`);
  },
);

Then('the response should have {string} set to {string}', (field: string, value: string) => {
  const result = getToolResult();
  assert.equal(result[field], value, `Expected ${field} to be ${value}`);
});

Then('the response should have a non-empty {string} field', (field: string) => {
  const result = getToolResult();
  assert.ok(
    typeof result[field] === 'string' && (result[field] as string).length > 0,
    `Expected non-empty ${field}`,
  );
});

Then('the {string} should be greater than {int}', (field: string, min: number) => {
  const result = getToolResult();
  assert.ok(
    typeof result[field] === 'number' && (result[field] as number) > min,
    `Expected ${field} > ${min}`,
  );
});

Then('the {string} should contain a failure description', (field: string) => {
  const result = getToolResult();
  const content = result[field] as string;
  assert.ok(
    typeof content === 'string' && content.length > 0,
    `Expected failure description in ${field}`,
  );
});

Then('the response should have the same shape as {string}', (_otherTool: string) => {
  const result = getToolResult();
  assert.ok(result.url !== undefined, 'Expected url field');
  assert.ok(result.content !== undefined, 'Expected content field');
  assert.ok(result.fetch_status !== undefined, 'Expected fetch_status field');
});
