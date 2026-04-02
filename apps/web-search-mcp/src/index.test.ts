import type { Config } from '@websearch/web-search-core';
import { describe, expect, it } from 'vitest';
import { createHonoApp } from './hono-app.js';

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

describe('createHonoApp', () => {
  it('GET /health returns 200 with status ok', async () => {
    const app = createHonoApp(makeTestConfig());
    const res = await app.request('/health');

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET / returns server info JSON', async () => {
    const app = createHonoApp(makeTestConfig());
    const res = await app.request('/');

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      name: 'web-search-mcp',
      version: '0.1.0',
      transport: 'streamable-http',
    });
  });

  it('POST /mcp accepts a JSON-RPC initialize request', async () => {
    const app = createHonoApp(makeTestConfig());

    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    };

    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(initRequest),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      jsonrpc: string;
      id: number;
      result: { protocolVersion: string; serverInfo: { name: string } };
    };
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(1);
    expect(body.result).toBeDefined();
    expect(body.result.protocolVersion).toBeDefined();
    expect(body.result.serverInfo).toBeDefined();
    expect(body.result.serverInfo.name).toBe('web-search-mcp');
  });
});

describe('CLI module', () => {
  it('can be imported without errors', async () => {
    const mod = await import('./hono-app.js');
    expect(mod.createHonoApp).toBeDefined();
    expect(typeof mod.createHonoApp).toBe('function');
  });

  it('serverless module re-exports createHonoApp', async () => {
    const mod = await import('./serverless.js');
    expect(mod.createHonoApp).toBeDefined();
    expect(typeof mod.createHonoApp).toBe('function');
  });

  it('bun-http module exports startBunServer', async () => {
    const mod = await import('./bun-http.js');
    expect(mod.startBunServer).toBeDefined();
    expect(typeof mod.startBunServer).toBe('function');
  });
});
