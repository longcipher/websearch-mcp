import { z } from 'zod';
import { ConfigurationError } from './errors.js';

const ConfigSchema = z.object({
  serperApiKey: z.string().optional(),
  tavilyApiKey: z.string().optional(),
  searxngBaseUrl: z.string().url().optional(),
  githubToken: z.string().optional(),
  httpProxy: z.string().url().optional(),
  httpsProxy: z.string().url().optional(),
  searchTimeoutMs: z.number().int().positive().default(10000),
  fetchTimeoutMs: z.number().int().positive().default(15000),
  searchTotalTimeoutMs: z.number().int().positive().default(30000),
  searchMaxConcurrency: z.number().int().positive().default(3),
  searchMaxResults: z.number().int().positive().default(10),
  fetchMaxChars: z.number().int().positive().default(50000),
  allowPrivateNetworkFetch: z.boolean().default(false),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  try {
    return ConfigSchema.parse({
      serperApiKey: env.SERPER_API_KEY,
      tavilyApiKey: env.TAVILY_API_KEY,
      searxngBaseUrl: env.SEARXNG_BASE_URL,
      githubToken: env.GITHUB_TOKEN,
      httpProxy: env.HTTP_PROXY,
      httpsProxy: env.HTTPS_PROXY,
      searchTimeoutMs: env.WEB_SEARCH_TIMEOUT_MS
        ? Number.parseInt(env.WEB_SEARCH_TIMEOUT_MS, 10)
        : undefined,
      fetchTimeoutMs: env.WEB_FETCH_TIMEOUT_MS
        ? Number.parseInt(env.WEB_FETCH_TIMEOUT_MS, 10)
        : undefined,
      searchTotalTimeoutMs: env.WEB_SEARCH_TOTAL_TIMEOUT_MS
        ? Number.parseInt(env.WEB_SEARCH_TOTAL_TIMEOUT_MS, 10)
        : undefined,
      searchMaxConcurrency: env.WEB_SEARCH_MAX_CONCURRENCY
        ? Number.parseInt(env.WEB_SEARCH_MAX_CONCURRENCY, 10)
        : undefined,
      searchMaxResults: env.WEB_SEARCH_MAX_RESULTS
        ? Number.parseInt(env.WEB_SEARCH_MAX_RESULTS, 10)
        : undefined,
      fetchMaxChars: env.WEB_FETCH_MAX_CHARS
        ? Number.parseInt(env.WEB_FETCH_MAX_CHARS, 10)
        : undefined,
      allowPrivateNetworkFetch: env.ALLOW_PRIVATE_NETWORK_FETCH === 'true',
      logLevel: env.LOG_LEVEL as
        | 'trace'
        | 'debug'
        | 'info'
        | 'warn'
        | 'error'
        | 'fatal'
        | undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new ConfigurationError(`Invalid configuration: ${issues}`, { cause: error });
    }
    throw error;
  }
}
