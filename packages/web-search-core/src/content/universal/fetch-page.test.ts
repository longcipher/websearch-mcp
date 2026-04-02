import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProviderError, TimeoutError } from '../../errors.js';
import { fetchPage } from './fetch-page.js';

describe('fetchPage', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    server = createServer();
    port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve((server.address() as { port: number }).port);
      });
    });
  });

  afterEach(() => {
    server.close();
  });

  it('fetches valid HTML page successfully', async () => {
    server.on('request', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body><h1>Hello</h1></body></html>');
    });

    const url = new URL(`http://127.0.0.1:${port}`);
    const result = await fetchPage(url, 5000);

    expect(result.html).toContain('<h1>Hello</h1>');
    expect(result.contentType).toContain('text/html');
  });

  it('rejects non-HTML content types', async () => {
    server.on('request', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ key: 'value' }));
    });

    const url = new URL(`http://127.0.0.1:${port}`);
    await expect(fetchPage(url, 5000)).rejects.toThrow(/Unsupported content type/);
  });

  it('enforces timeout', async () => {
    server.on('request', (_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>Delayed</body></html>');
      }, 5000);
    });

    const url = new URL(`http://127.0.0.1:${port}`);
    await expect(fetchPage(url, 100)).rejects.toThrow(TimeoutError);
  });

  it('handles HTTP 404 error status', async () => {
    server.on('request', (_req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html><body>Not Found</body></html>');
    });

    const url = new URL(`http://127.0.0.1:${port}`);
    await expect(fetchPage(url, 5000)).rejects.toThrow(ProviderError);
  });

  it('handles HTTP 500 error status', async () => {
    server.on('request', (_req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<html><body>Server Error</body></html>');
    });

    const url = new URL(`http://127.0.0.1:${port}`);
    await expect(fetchPage(url, 5000)).rejects.toThrow(ProviderError);
  });

  it('handles application/xhtml+xml content type', async () => {
    server.on('request', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/xhtml+xml' });
      res.end(
        '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body>XHTML</body></html>',
      );
    });

    const url = new URL(`http://127.0.0.1:${port}`);
    const result = await fetchPage(url, 5000);
    expect(result.html).toContain('XHTML');
  });

  it('follows redirects', async () => {
    let requestCount = 0;
    server.on('request', (_req, res) => {
      requestCount++;
      if (requestCount === 1) {
        res.writeHead(302, { Location: `http://127.0.0.1:${port}/final` });
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>Final</body></html>');
      }
    });

    const url = new URL(`http://127.0.0.1:${port}`);
    const result = await fetchPage(url, 5000);
    expect(result.html).toContain('Final');
  });

  it('handles missing response body', async () => {
    server.on('request', (_req, res) => {
      res.writeHead(204, { 'Content-Type': 'text/html' });
      res.end();
    });

    const url = new URL(`http://127.0.0.1:${port}`);
    await expect(fetchPage(url, 5000)).rejects.toThrow(/No response body/);
  });

  it('rejects XML content type', async () => {
    server.on('request', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end('<?xml version="1.0"?><root/>');
    });

    const url = new URL(`http://127.0.0.1:${port}`);
    await expect(fetchPage(url, 5000)).rejects.toThrow(/Unsupported content type/);
  });

  it('rejects plain text content type', async () => {
    server.on('request', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Just plain text');
    });

    const url = new URL(`http://127.0.0.1:${port}`);
    await expect(fetchPage(url, 5000)).rejects.toThrow(/Unsupported content type/);
  });
});
