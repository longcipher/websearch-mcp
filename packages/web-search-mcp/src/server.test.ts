import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Config } from '@websearch/web-search-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWebSearchServer } from './server.js';

function makeTestConfig(overrides: Partial<Config> = {}): Config {
  return {
    serperApiKey: undefined,
    tavilyApiKey: undefined,
    searxngBaseUrl: undefined,
    githubToken: undefined,
    httpProxy: undefined,
    httpsProxy: undefined,
    searchTimeoutMs: 5000,
    fetchTimeoutMs: 5000,
    searchTotalTimeoutMs: 15000,
    searchMaxConcurrency: 3,
    searchMaxResults: 10,
    fetchMaxChars: 50000,
    allowPrivateNetworkFetch: true,
    logLevel: 'error',
    ...overrides,
  };
}

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

function firstTextContent(result: ToolResult): string {
  expect(result.content.length).toBeGreaterThan(0);
  const item = result.content[0];
  expect(item).toBeDefined();
  expect(item?.type).toBe('text');
  return item?.text ?? '';
}

function createTestServer(
  handler: (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
  ) => void,
): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        port,
        close: () => {
          server.close();
        },
      });
    });
  });
}

async function createTestPair(config?: Config) {
  const { server } = createWebSearchServer(config ?? makeTestConfig());

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

describe('createWebSearchServer', () => {
  it('should create a server with config and logger', () => {
    const config = makeTestConfig();
    const result = createWebSearchServer(config);

    expect(result.server).toBeDefined();
    expect(result.config).toBe(config);
    expect(result.logger).toBeDefined();
  });

  it('should create a server with default config when none provided', () => {
    const result = createWebSearchServer();
    expect(result.server).toBeDefined();
    expect(result.config).toBeDefined();
    expect(result.logger).toBeDefined();
  });
});

describe('MCP server tools', () => {
  let client: Client;

  beforeAll(async () => {
    const pair = await createTestPair();
    client = pair.client;
  });

  afterAll(async () => {
    await client.close();
  });

  it('should register all 3 tools', async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name);

    expect(toolNames).toContain('web_search');
    expect(toolNames).toContain('web_fetch');
    expect(toolNames).toContain('get_content');
    expect(result.tools).toHaveLength(3);
  });

  it('should have correct descriptions for each tool', async () => {
    const result = await client.listTools();
    const toolMap = Object.fromEntries(result.tools.map((t) => [t.name, t]));

    expect(toolMap.web_search?.description).toContain('Search the web');
    expect(toolMap.web_fetch?.description).toContain('Fetch and extract');
    expect(toolMap.get_content?.description).toContain('alias for web_fetch');
  });

  it('should have input schemas for all tools', async () => {
    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema?.type).toBe('object');
      expect(tool.inputSchema?.properties).toBeDefined();
    }
  });
});

describe('web_search tool', () => {
  it('should call web_search and return a response structure', async () => {
    const config = makeTestConfig();
    const { server } = createWebSearchServer(config);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = (await client.callTool({
      name: 'web_search',
      arguments: { query: 'test query', num_results: 1 },
    })) as ToolResult;

    const text = firstTextContent(result);
    const parsed = JSON.parse(text);
    expect(parsed.query).toBe('test query');
    expect(parsed.results).toBeDefined();
    expect(Array.isArray(parsed.results)).toBe(true);

    await client.close();
  }, 30000);
});

describe('web_fetch tool', () => {
  let testPort: number;
  let closeServer: () => void;

  beforeAll(async () => {
    const { port, close } = await createTestServer((req, res) => {
      if (req.url === '/test-page') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<html><head><title>Test Page</title></head><body><main><h1>Hello</h1><p>Test content</p></main></body></html>',
        );
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
    });
    testPort = port;
    closeServer = close;
  });

  afterAll(() => {
    closeServer();
  });

  it('should fetch and extract content from a URL', async () => {
    const config = makeTestConfig({ allowPrivateNetworkFetch: true });
    const { server } = createWebSearchServer(config);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = (await client.callTool({
      name: 'web_fetch',
      arguments: { url: `http://localhost:${testPort}/test-page` },
    })) as ToolResult;

    const text = firstTextContent(result);
    const parsed = JSON.parse(text);
    expect(parsed.url).toBeDefined();
    expect(parsed.content_kind).toBeDefined();
    expect(parsed.fetch_status).toBe('ok');
    expect(parsed.content_length).toBeGreaterThan(0);
    expect(parsed.content).toContain('Hello');

    await client.close();
  }, 15000);

  it('should handle fetch errors gracefully', async () => {
    const config = makeTestConfig({ allowPrivateNetworkFetch: true });
    const { server } = createWebSearchServer(config);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = (await client.callTool({
      name: 'web_fetch',
      arguments: { url: 'http://localhost:1/nonexistent-page' },
    })) as ToolResult;

    const text = firstTextContent(result);
    const parsed = JSON.parse(text);
    expect(parsed.fetch_status).not.toBe('ok');

    await client.close();
  }, 15000);
});

describe('get_content alias', () => {
  let testPort: number;
  let closeServer: () => void;

  beforeAll(async () => {
    const { port, close } = await createTestServer((req, res) => {
      if (req.url === '/alias-test') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<html><head><title>Alias Test</title></head><body><main><p>Alias content</p></main></body></html>',
        );
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
    });
    testPort = port;
    closeServer = close;
  });

  afterAll(() => {
    closeServer();
  });

  it('should return same format as web_fetch', async () => {
    const config = makeTestConfig({ allowPrivateNetworkFetch: true });
    const { server } = createWebSearchServer(config);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const getContentResult = (await client.callTool({
      name: 'get_content',
      arguments: { url: `http://localhost:${testPort}/alias-test` },
    })) as ToolResult;

    const webFetchResult = (await client.callTool({
      name: 'web_fetch',
      arguments: { url: `http://localhost:${testPort}/alias-test` },
    })) as ToolResult;

    const getContentParsed = JSON.parse(firstTextContent(getContentResult));
    const webFetchParsed = JSON.parse(firstTextContent(webFetchResult));

    expect(getContentParsed.fetch_status).toBe(webFetchParsed.fetch_status);
    expect(getContentParsed.content_kind).toBe(webFetchParsed.content_kind);
    expect(getContentParsed.content).toBe(webFetchParsed.content);

    await client.close();
  }, 15000);
});
