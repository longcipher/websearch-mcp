import { afterEach, describe, expect, it } from 'vitest';
import type { Config } from '../config.js';
import { closeProxyAgents, getDispatcherForUrl, getProxyAgents } from './proxy-agent.js';

describe('getProxyAgents', () => {
  afterEach(() => {
    closeProxyAgents();
  });

  it('returns undefined agents when no proxy configured', () => {
    const config: Config = {
      searchTimeoutMs: 10000,
      fetchTimeoutMs: 15000,
      searchTotalTimeoutMs: 30000,
      searchMaxConcurrency: 3,
      searchMaxResults: 10,
      fetchMaxChars: 50000,
      allowPrivateNetworkFetch: false,
      logLevel: 'info',
    };
    const agents = getProxyAgents(config);
    expect(agents.http).toBeUndefined();
    expect(agents.https).toBeUndefined();
  });

  it('creates agents when proxy URLs are configured', () => {
    const config: Config = {
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      searchTimeoutMs: 10000,
      fetchTimeoutMs: 15000,
      searchTotalTimeoutMs: 30000,
      searchMaxConcurrency: 3,
      searchMaxResults: 10,
      fetchMaxChars: 50000,
      allowPrivateNetworkFetch: false,
      logLevel: 'info',
    };
    const agents = getProxyAgents(config);
    expect(agents.http).toBeDefined();
    expect(agents.https).toBeDefined();
  });

  it('caches by config', () => {
    const config: Config = {
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      searchTimeoutMs: 10000,
      fetchTimeoutMs: 15000,
      searchTotalTimeoutMs: 30000,
      searchMaxConcurrency: 3,
      searchMaxResults: 10,
      fetchMaxChars: 50000,
      allowPrivateNetworkFetch: false,
      logLevel: 'info',
    };
    const agents1 = getProxyAgents(config);
    const agents2 = getProxyAgents(config);
    expect(agents1).toBe(agents2);
  });
});

describe('getDispatcherForUrl', () => {
  afterEach(() => {
    closeProxyAgents();
  });

  it('returns https agent for https URLs', () => {
    const config: Config = {
      httpsProxy: 'http://proxy.example.com:8080',
      searchTimeoutMs: 10000,
      fetchTimeoutMs: 15000,
      searchTotalTimeoutMs: 30000,
      searchMaxConcurrency: 3,
      searchMaxResults: 10,
      fetchMaxChars: 50000,
      allowPrivateNetworkFetch: false,
      logLevel: 'info',
    };
    const dispatcher = getDispatcherForUrl(config, 'https://example.com');
    expect(dispatcher).toBeDefined();
  });

  it('returns http agent for http URLs', () => {
    const config: Config = {
      httpProxy: 'http://proxy.example.com:8080',
      searchTimeoutMs: 10000,
      fetchTimeoutMs: 15000,
      searchTotalTimeoutMs: 30000,
      searchMaxConcurrency: 3,
      searchMaxResults: 10,
      fetchMaxChars: 50000,
      allowPrivateNetworkFetch: false,
      logLevel: 'info',
    };
    const dispatcher = getDispatcherForUrl(config, 'http://example.com');
    expect(dispatcher).toBeDefined();
  });

  it('returns undefined when no proxy configured', () => {
    const config: Config = {
      searchTimeoutMs: 10000,
      fetchTimeoutMs: 15000,
      searchTotalTimeoutMs: 30000,
      searchMaxConcurrency: 3,
      searchMaxResults: 10,
      fetchMaxChars: 50000,
      allowPrivateNetworkFetch: false,
      logLevel: 'info',
    };
    const dispatcher = getDispatcherForUrl(config, 'https://example.com');
    expect(dispatcher).toBeUndefined();
  });
});

describe('closeProxyAgents', () => {
  it('clears the cache', () => {
    const config: Config = {
      httpProxy: 'http://proxy.example.com:8080',
      httpsProxy: 'http://proxy.example.com:8080',
      searchTimeoutMs: 10000,
      fetchTimeoutMs: 15000,
      searchTotalTimeoutMs: 30000,
      searchMaxConcurrency: 3,
      searchMaxResults: 10,
      fetchMaxChars: 50000,
      allowPrivateNetworkFetch: false,
      logLevel: 'info',
    };
    const agents1 = getProxyAgents(config);
    expect(agents1.http).toBeDefined();
    closeProxyAgents();
    const agents2 = getProxyAgents(config);
    expect(agents2.http).toBeDefined();
    expect(agents1).not.toBe(agents2);
  });
});
