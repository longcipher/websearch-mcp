import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '@websearch/web-search-core';
import {
  AntiBotBlockError,
  ContentResolverChain,
  type createLogger,
  getDispatcherForUrl,
  resolveAndValidateUrl,
  SecurityBlockError,
  TimeoutError,
  UnsupportedContentError,
} from '@websearch/web-search-core';
import { z } from 'zod';

type Logger = ReturnType<typeof createLogger>;

export const fetchToolInputSchema = {
  url: z.string().url(),
  max_char_size: z.number().int().min(100).max(500000).default(50000),
};

interface FetchResult {
  url: string;
  content_kind: string;
  fetch_status: string;
  content_length: number;
  content: string;
}

function successResponse(result: FetchResult) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}

function errorResponse(url: string, status: string, message: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            url,
            content_kind: 'unknown',
            fetch_status: status,
            content_length: 0,
            content: message,
          },
          null,
          2,
        ),
      },
    ],
  };
}

function classifyError(err: unknown): string {
  if (err instanceof TimeoutError) return 'timeout';
  if (err instanceof SecurityBlockError) return 'security_block';
  if (err instanceof AntiBotBlockError) return 'anti_bot_block';
  if (err instanceof UnsupportedContentError) return 'unsupported_content';
  return 'error';
}

export function registerFetchTool(
  server: McpServer,
  config: Config,
  logger: Logger,
  name: string,
  description: string,
): void {
  server.tool(name, description, fetchToolInputSchema, async (params) => {
    logger.info({ url: params.url }, `${name} called`);

    try {
      const url = await resolveAndValidateUrl(params.url, config.allowPrivateNetworkFetch);
      const dispatcher = getDispatcherForUrl(config, params.url);
      const resolver = new ContentResolverChain();

      const resolved = await resolver.resolve(url, {
        timeoutMs: config.fetchTimeoutMs,
        maxChars: Math.min(params.max_char_size, config.fetchMaxChars),
        dispatcher,
      });

      if (!resolved) {
        return errorResponse(
          params.url,
          'error',
          'Failed to retrieve page content: no resolver could handle this URL',
        );
      }

      return successResponse({
        url: params.url,
        content_kind: resolved.content_kind,
        fetch_status: 'ok',
        content_length: resolved.content.length,
        content: resolved.content,
      });
    } catch (err) {
      return errorResponse(
        params.url,
        classifyError(err),
        `Failed to retrieve page content: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
}
