import { type Dispatcher, ProxyAgent } from 'undici';
import type { Config } from '../config.js';

interface ProxyAgents {
  http: Dispatcher | undefined;
  https: Dispatcher | undefined;
}

const agentCache = new Map<string, ProxyAgents>();

export function getProxyAgents(config: Config): ProxyAgents {
  const cacheKey = `${config.httpProxy ?? ''}:${config.httpsProxy ?? ''}`;
  const cached = agentCache.get(cacheKey);
  if (cached) return cached;

  const agents: ProxyAgents = {
    http: config.httpProxy ? new ProxyAgent(config.httpProxy) : undefined,
    https: config.httpsProxy ? new ProxyAgent(config.httpsProxy) : undefined,
  };

  agentCache.set(cacheKey, agents);
  return agents;
}

export function closeProxyAgents(): void {
  for (const agents of agentCache.values()) {
    agents.http?.close?.();
    agents.https?.close?.();
  }
  agentCache.clear();
}

export function getDispatcherForUrl(config: Config, url: string | URL): Dispatcher | undefined {
  const urlString = url.toString();
  const agents = getProxyAgents(config);
  return urlString.startsWith('https://') ? agents.https : agents.http;
}
