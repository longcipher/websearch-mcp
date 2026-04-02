import * as cheerio from 'cheerio';
import { SecurityBlockError, TimeoutError } from '../../errors.js';
import type { ContentResolver, ResolveContext, ResolvedContent } from '../../schemas.js';
import { extractMainContent } from '../universal/extract-main-content.js';
import { fetchPage } from '../universal/fetch-page.js';
import { htmlToMarkdown } from '../universal/markdown.js';
import { sanitizeMarkdown } from '../universal/sanitize.js';

export class GitHubIssueResolver implements ContentResolver {
  canHandle(url: URL): boolean {
    return url.hostname === 'github.com' && /^\/[^/]+\/[^/]+\/issues\/\d+/.test(url.pathname);
  }

  async resolve(url: URL, context: ResolveContext): Promise<ResolvedContent | null> {
    try {
      const { html } = await fetchPage(url, context.timeoutMs, context.dispatcher);
      const $ = cheerio.load(html);

      const title = $('h1.gh-header-title .markdown-title, h1 .js-issue-title')
        .first()
        .text()
        .trim();
      const issueBody = $('div.comment-body, .js-comment-body').first().html();
      const bodyMd = issueBody ? htmlToMarkdown(extractMainContent(issueBody)) : '';

      const comments: string[] = [];
      $('div.timeline-comment, .js-comment').each((i, el) => {
        if (i === 0) return; // skip the issue body itself
        const commentBody = $(el).find('.comment-body, .js-comment-body').html();
        if (commentBody) {
          const commentMd = htmlToMarkdown(commentBody);
          if (commentMd.trim()) {
            const user = $(el).find('.author, .comment-header a').first().text().trim();
            comments.push(`### Comment by ${user || 'unknown'}\n\n${commentMd}`);
          }
        }
      });

      const parts: string[] = [];
      if (title) parts.push(`# ${title}\n`);
      if (bodyMd) parts.push(bodyMd);
      if (comments.length > 0) {
        parts.push('## Comments\n');
        parts.push(comments.join('\n\n---\n\n'));
      }

      const content = sanitizeMarkdown(parts.join('\n\n'), context.maxChars);

      return {
        url: url.toString(),
        content_kind: 'github_issue',
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
