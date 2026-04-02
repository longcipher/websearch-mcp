import { describe, expect, it } from 'vitest';
import { ContentResolverChain } from '../src/content/resolve.js';
import { htmlToMarkdown } from '../src/content/universal/markdown.js';
import { sanitizeMarkdown } from '../src/content/universal/sanitize.js';
import type { ContentResolver, ResolveContext, ResolvedContent } from '../src/schemas.js';

const syncValidate = async (url: string): Promise<URL> => new URL(url);

class MockResolver implements ContentResolver {
  constructor(
    private readonly pattern: string,
    private readonly kind: string,
  ) {}

  canHandle(url: URL): boolean {
    return url.hostname.includes(this.pattern);
  }

  async resolve(url: URL, _context: ResolveContext): Promise<ResolvedContent | null> {
    return {
      url: url.toString(),
      content_kind: this.kind as ResolvedContent['content_kind'],
      content: `Content from ${this.kind}`,
    };
  }
}

describe('ContentResolverChain', () => {
  it('routes to the first matching resolver', async () => {
    const chain = new ContentResolverChain(
      [
        new MockResolver('github.com', 'github_issue'),
        new MockResolver('stackoverflow.com', 'stackexchange'),
      ],
      { validateUrl: syncValidate },
    );

    const url = new URL('https://github.com/user/repo/issues/1');
    const result = await chain.resolve(url, { timeoutMs: 5000, maxChars: 10000 });
    expect(result).not.toBeNull();
    expect(result?.content_kind).toBe('github_issue');
  });

  it('falls through to later resolvers', async () => {
    const chain = new ContentResolverChain(
      [
        new MockResolver('github.com', 'github_issue'),
        new MockResolver('stackoverflow.com', 'stackexchange'),
      ],
      { validateUrl: syncValidate },
    );

    const url = new URL('https://stackoverflow.com/questions/123');
    const result = await chain.resolve(url, { timeoutMs: 5000, maxChars: 10000 });
    expect(result).not.toBeNull();
    expect(result?.content_kind).toBe('stackexchange');
  });

  it('returns null when no resolver matches', async () => {
    const chain = new ContentResolverChain([new MockResolver('github.com', 'github_issue')], {
      validateUrl: syncValidate,
    });

    const url = new URL('https://unknown-site.com/page');
    const result = await chain.resolve(url, { timeoutMs: 5000, maxChars: 10000 });
    expect(result).toBeNull();
  });

  it('canHandle returns true if any resolver matches', () => {
    const chain = new ContentResolverChain(
      [
        new MockResolver('github.com', 'github_issue'),
        new MockResolver('stackoverflow.com', 'stackexchange'),
      ],
      { validateUrl: syncValidate },
    );

    expect(chain.canHandle(new URL('https://github.com/1'))).toBe(true);
    expect(chain.canHandle(new URL('https://stackoverflow.com/1'))).toBe(true);
    expect(chain.canHandle(new URL('https://other.com/1'))).toBe(false);
  });

  it('uses default resolvers when none provided', () => {
    const chain = new ContentResolverChain();
    expect(chain.canHandle(new URL('https://github.com/user/repo/issues/1'))).toBe(true);
    expect(chain.canHandle(new URL('https://stackoverflow.com/questions/123'))).toBe(true);
    expect(chain.canHandle(new URL('https://en.wikipedia.org/wiki/Test'))).toBe(true);
    expect(chain.canHandle(new URL('https://example.com/page'))).toBe(true);
  });
});

describe('htmlToMarkdown', () => {
  it('converts simple HTML to markdown', () => {
    const html = '<h1>Title</h1><p>Some <strong>bold</strong> text.</p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('Title');
    expect(md).toContain('**bold**');
  });

  it('converts links', () => {
    const html = '<p>Visit <a href="https://example.com">Example</a></p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('[Example](https://example.com)');
  });

  it('converts code blocks', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('const x = 1;');
  });

  it('converts lists', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('Item 1');
    expect(md).toContain('Item 2');
  });
});

describe('sanitizeMarkdown', () => {
  it('normalizes whitespace', () => {
    const input = 'Line 1   \n\n\n\nLine 2\n\n\n\nLine 3';
    const result = sanitizeMarkdown(input, 1000);
    expect(result).not.toContain('\n\n\n');
  });

  it('preserves code blocks within limit', () => {
    const input = 'Before\n```\ncode here\n```\nAfter';
    const result = sanitizeMarkdown(input, 1000);
    expect(result).toContain('```\ncode here\n```');
  });

  it('truncates at word boundary', () => {
    const input = 'word '.repeat(200).trim();
    const result = sanitizeMarkdown(input, 100);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result).toContain('[...truncated]');
  });

  it('does not truncate if within limit', () => {
    const input = 'Short content';
    const result = sanitizeMarkdown(input, 1000);
    expect(result).toBe('Short content');
  });

  it('truncates after complete code block when block exceeds limit', () => {
    const before = 'A'.repeat(10);
    const code = `\`\`\`\n${'X'.repeat(100)}\n\`\`\``;
    const after = 'B'.repeat(100);
    const input = `${before}\n${code}\n${after}`;
    const result = sanitizeMarkdown(input, 20);
    expect(result).toContain('[...truncated]');
  });

  it('handles empty input', () => {
    expect(sanitizeMarkdown('', 100)).toBe('');
  });
});
