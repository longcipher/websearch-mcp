import * as cheerio from 'cheerio';
import { SecurityBlockError, TimeoutError } from '../../errors.js';
import type { ContentResolver, ResolveContext, ResolvedContent } from '../../schemas.js';
import { extractMainContent } from '../universal/extract-main-content.js';
import { fetchPage } from '../universal/fetch-page.js';
import { htmlToMarkdown } from '../universal/markdown.js';
import { sanitizeMarkdown } from '../universal/sanitize.js';

export class WikipediaResolver implements ContentResolver {
  canHandle(url: URL): boolean {
    return (
      (url.hostname === 'wikipedia.org' || url.hostname.endsWith('.wikipedia.org')) &&
      url.pathname.startsWith('/wiki/')
    );
  }

  async resolve(url: URL, context: ResolveContext): Promise<ResolvedContent | null> {
    try {
      const { html } = await fetchPage(url, context.timeoutMs, context.dispatcher);
      const $ = cheerio.load(html);

      const title = $('h1#firstHeading, h1.firstHeading').first().text().trim();

      const contentEl = $('div.mw-parser-output').first();

      contentEl.find('.infobox, .navbox, .metadata, .ambox, .hatnote').remove();
      contentEl.find('.mw-editsection, .mw-jump-link, .mw-empty-elt').remove();
      contentEl.find('.toc, .sistersitebox, .noprint').remove();
      contentEl.find('table').remove();

      const contentHtml = contentEl.html();
      const contentMd = contentHtml ? htmlToMarkdown(extractMainContent(contentHtml)) : '';

      const content = sanitizeMarkdown(contentMd, context.maxChars);

      return {
        url: url.toString(),
        content_kind: 'wikipedia',
        content,
        title: title || undefined,
      };
    } catch (error) {
      if (error instanceof TimeoutError) throw error;
      if (error instanceof SecurityBlockError) throw error;
      return null;
    }
  }
}
