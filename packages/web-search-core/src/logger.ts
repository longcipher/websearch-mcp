import pino from 'pino';
import type { Config } from './config.js';

export function createLogger(config: Config): pino.Logger {
  return pino({
    level: config.logLevel,
  });
}
