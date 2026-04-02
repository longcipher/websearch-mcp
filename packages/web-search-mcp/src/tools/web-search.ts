import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config, createLogger } from '@websearch/web-search-core';
import {
  aggregateSearch,
  ContentResolverChain,
  getDispatcherForUrl,
} from '@websearch/web-search-core';
import { z } from 'zod';

type Logger = ReturnType<typeof createLogger>;

const webSearchInputSchema = {
  query: z.string().min(1),
  num_results: z.number().int().min(1).max(20).default(5),
  include_page_content: z.boolean().default(true),
  max_enriched_results: z.number().int().min(0).max(10).default(3),
};

async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  const executing = new Set<Promise<void>>();

  for (const task of tasks) {
    const p = task()
      .then(
        (value) => {
          results.push({ status: 'fulfilled', value });
        },
        (reason) => {
          results.push({ status: 'rejected', reason });
        },
      )
      .finally(() => {
        executing.delete(p);
      });

    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

export function registerWebSearchTool(server: McpServer, config: Config, logger: Logger): void {
  server.tool(
    'web_search',
    'Search the web across multiple providers',
    webSearchInputSchema,
    async (params) => {
      logger.info({ query: params.query, num_results: params.num_results }, 'web_search called');

      try {
        const results = await aggregateSearch(params.query, params.num_results, config);

        if (params.include_page_content && params.max_enriched_results > 0) {
          const resolver = new ContentResolverChain();
          const toEnrich = results.slice(0, params.max_enriched_results);

          await withConcurrencyLimit(
            toEnrich.map((result) => async () => {
              try {
                const url = new URL(result.url);
                const resolveContext: {
                  timeoutMs: number;
                  maxChars: number;
                  dispatcher?: import('undici').Dispatcher;
                } = {
                  timeoutMs: config.fetchTimeoutMs,
                  maxChars: config.fetchMaxChars,
                };
                const dispatcher = getDispatcherForUrl(config, result.url);
                if (dispatcher) {
                  resolveContext.dispatcher = dispatcher;
                }
                const resolved = await resolver.resolve(url, resolveContext);

                if (resolved) {
                  result.page_content = resolved.content;
                  result.fetch_status = 'ok';
                } else {
                  result.fetch_status = 'timeout';
                }
              } catch (err) {
                logger.warn({ url: result.url, err }, 'Failed to enrich search result');
                result.fetch_status = 'error';
              }
            }),
            config.searchMaxConcurrency,
          );
        }

        const response = {
          query: params.query,
          num_results: results.length,
          results,
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (err) {
        logger.error({ err }, 'web_search failed');
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: String(err) }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
