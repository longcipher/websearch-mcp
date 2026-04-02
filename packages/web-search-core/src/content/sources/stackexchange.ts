import * as cheerio from 'cheerio';
import { SecurityBlockError, TimeoutError } from '../../errors.js';
import type { ContentResolver, ResolveContext, ResolvedContent } from '../../schemas.js';
import { extractMainContent } from '../universal/extract-main-content.js';
import { fetchPage } from '../universal/fetch-page.js';
import { htmlToMarkdown } from '../universal/markdown.js';
import { sanitizeMarkdown } from '../universal/sanitize.js';

const SE_SITES = [
  'stackoverflow.com',
  'stackexchange.com',
  'serverfault.com',
  'superuser.com',
  'askubuntu.com',
  'mathoverflow.net',
];

export class StackExchangeResolver implements ContentResolver {
  canHandle(url: URL): boolean {
    return (
      SE_SITES.some((site) => url.hostname === site || url.hostname.endsWith(`.${site}`)) &&
      /\/questions\/\d+/.test(url.pathname)
    );
  }

  async resolve(url: URL, context: ResolveContext): Promise<ResolvedContent | null> {
    try {
      const { html } = await fetchPage(url, context.timeoutMs, context.dispatcher);
      const $ = cheerio.load(html);

      const title = $('h1 a.question-hyperlink, #question-header h1 a').first().text().trim();

      const questionBody = $('div.question .js-post-body, .postcell .js-post-body').first().html();
      const questionMd = questionBody ? htmlToMarkdown(extractMainContent(questionBody)) : '';

      const answers: string[] = [];
      $('div.answer').each((_i, el) => {
        const $answer = $(el);
        const isAccepted =
          $answer.hasClass('accepted-answer') || $answer.find('.accepted-answer').length > 0;
        const answerBody = $answer.find('.js-post-body, .answercell .js-post-body').html();
        const score = $answer.find('.js-vote-count, .vote-count-post').first().text().trim();

        if (answerBody) {
          const answerMd = htmlToMarkdown(answerBody);
          const label = isAccepted ? '✅ Accepted Answer' : `Answer (score: ${score || '0'})`;
          answers.push(`## ${label}\n\n${answerMd}`);
        }
      });

      const parts: string[] = [];
      if (title) parts.push(`# ${title}\n`);
      if (questionMd) {
        parts.push('## Question\n');
        parts.push(questionMd);
      }
      if (answers.length > 0) {
        parts.push('\n## Answers\n');
        parts.push(answers.join('\n\n---\n\n'));
      }

      const content = sanitizeMarkdown(parts.join('\n\n'), context.maxChars);

      return {
        url: url.toString(),
        content_kind: 'stackexchange',
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
