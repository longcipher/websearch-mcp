import { defineCommand, runMain } from 'citty';

const stdioCommand = defineCommand({
  meta: {
    name: 'stdio',
    description: 'Start MCP server over stdio transport',
  },
  async run() {
    const { loadConfig } = await import('@websearch/web-search-core');
    const { createWebSearchServer } = await import('@websearch/web-search-mcp');
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');

    const config = loadConfig();
    const { server, logger } = createWebSearchServer(config);
    const transport = new StdioServerTransport();

    await server.connect(transport);
    logger.info('MCP server started over stdio transport');
  },
});

const httpCommand = defineCommand({
  meta: {
    name: 'http',
    description: 'Start HTTP server',
  },
  args: {
    port: {
      type: 'string',
      description: 'Port number',
      default: '3000',
    },
  },
  async run({ args }) {
    const { startBunServer } = await import('./bun-http.js');
    const port = Number(args.port) || 3000;
    await startBunServer(undefined, port);
  },
});

const main = defineCommand({
  meta: {
    name: 'web-search-mcp',
    version: '0.1.0',
    description: 'Web Search MCP Server',
  },
  subCommands: {
    stdio: stdioCommand,
    http: httpCommand,
  },
});

runMain(main);
