import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { Config } from '@websearch/web-search-core';
import { createWebSearchServer } from '@websearch/web-search-mcp';
import { Hono } from 'hono';

interface AppContext {
  server: McpServer;
  config: Config;
}

function getAppContext(config?: Config): AppContext {
  const { server, config: resolvedConfig } = createWebSearchServer(config);
  return { server, config: resolvedConfig };
}

export function createHonoApp(config?: Config): Hono {
  const app = new Hono();
  const ctx = getAppContext(config);

  app.get('/health', (c) => {
    return c.json({ status: 'ok' });
  });

  app.get('/', (c) => {
    return c.json({
      name: 'web-search-mcp',
      version: '0.1.0',
      transport: 'streamable-http',
    });
  });

  app.all('/mcp', async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    await ctx.server.connect(transport);

    try {
      const response = await transport.handleRequest(c.req.raw);
      return response;
    } finally {
      await transport.close();
    }
  });

  return app;
}
