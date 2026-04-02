import { SecurityBlockError, TimeoutError } from '../errors.js';
import type { ContentResolver, ResolveContext, ResolvedContent } from '../schemas.js';
import { GitHubIssueResolver } from './sources/github-issue.js';
import { StackExchangeResolver } from './sources/stackexchange.js';
import { WikipediaResolver } from './sources/wikipedia.js';
import { extractMainContent } from './universal/extract-main-content.js';
import { fetchPage } from './universal/fetch-page.js';
import { htmlToMarkdown } from './universal/markdown.js';
import { sanitizeMarkdown } from './universal/sanitize.js';

class GenericHtmlResolver implements ContentResolver {
  canHandle(_url: URL): boolean {
    return true;
  }

  async resolve(url: URL, context: ResolveContext): Promise<ResolvedContent | null> {
    try {
      const { html } = await fetchPage(url, context.timeoutMs, context.dispatcher);
      const mainHtml = extractMainContent(html);
      const markdown = htmlToMarkdown(mainHtml);
      const content = sanitizeMarkdown(markdown, context.maxChars);

      return {
        url: url.toString(),
        content_kind: 'generic_html',
        content,
      };
    } catch (error) {
      if (error instanceof TimeoutError) throw error;
      if (error instanceof SecurityBlockError) throw error;
      return null;
    }
  }
}

export class ContentResolverChain {
  private resolvers: ContentResolver[];
  private validateUrlFn: ((url: string) => Promise<URL>) | null;

  constructor(
    resolvers?: ContentResolver[],
    options?: { validateUrl?: (url: string) => Promise<URL> },
  ) {
    this.resolvers = resolvers ?? [
      new GitHubIssueResolver(),
      new StackExchangeResolver(),
      new WikipediaResolver(),
      new GenericHtmlResolver(),
    ];
    this.validateUrlFn = options?.validateUrl ?? null;
  }

  canHandle(url: URL): boolean {
    return this.resolvers.some((r) => r.canHandle(url));
  }

  async resolve(url: URL, context: ResolveContext): Promise<ResolvedContent | null> {
    const safeUrl = this.validateUrlFn ? await this.validateUrlFn(url.toString()) : url;

    for (const resolver of this.resolvers) {
      if (resolver.canHandle(safeUrl)) {
        const result = await resolver.resolve(safeUrl, context);
        if (result) return result;
      }
    }
    return null;
  }
}

export { GitHubIssueResolver, StackExchangeResolver, WikipediaResolver };
