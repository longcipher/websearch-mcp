import type { Config } from '@websearch/web-search-core';
import { createHonoApp } from './hono-app.js';

export async function startBunServer(
  config?: Config,
  port = 3000,
): Promise<{ port: number; stop: () => void }> {
  const app = createHonoApp(config);

  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });

  const actualPort = server.port ?? port;
  return {
    port: actualPort,
    stop: () => server.stop(),
  };
}
