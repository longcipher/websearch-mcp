import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config, createLogger } from '@websearch/web-search-core';
import { registerFetchTool } from './fetch-tool.js';

type Logger = ReturnType<typeof createLogger>;

export function registerGetContentTool(server: McpServer, config: Config, logger: Logger): void {
  registerFetchTool(
    server,
    config,
    logger,
    'get_content',
    'Fetch and extract content from a URL (alias for web_fetch)',
  );
}
