import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '@websearch/web-search-core';
import { createLogger, loadConfig } from '@websearch/web-search-core';
import { registerGetContentTool } from './tools/get-content.js';
import { registerWebFetchTool } from './tools/web-fetch.js';
import { registerWebSearchTool } from './tools/web-search.js';

type Logger = ReturnType<typeof createLogger>;

export function createWebSearchServer(config?: Config): {
  server: McpServer;
  config: Config;
  logger: Logger;
} {
  const resolvedConfig = config ?? loadConfig();
  const logger = createLogger(resolvedConfig);

  const server = new McpServer({
    name: 'web-search-mcp',
    version: '0.1.0',
  });

  registerWebSearchTool(server, resolvedConfig, logger);
  registerWebFetchTool(server, resolvedConfig, logger);
  registerGetContentTool(server, resolvedConfig, logger);

  return { server, config: resolvedConfig, logger };
}
