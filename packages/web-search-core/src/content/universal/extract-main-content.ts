import * as cheerio from 'cheerio';

export function extractMainContent(html: string): string {
  const $ = cheerio.load(html);

  $('script, style, nav, footer, header, aside, iframe, noscript, svg').remove();

  const mainSelectors = ['main', 'article', '[role="main"]', '#main-content', '.main-content'];
  for (const selector of mainSelectors) {
    const el = $(selector).first();
    if (el.length > 0) {
      const text = el.html();
      if (text && text.trim().length > 100) {
        return text;
      }
    }
  }

  const contentSelectors = ['.post-content', '.entry-content', '.article-content', '.content'];
  for (const selector of contentSelectors) {
    const el = $(selector).first();
    if (el.length > 0) {
      const text = el.html();
      if (text && text.trim().length > 100) {
        return text;
      }
    }
  }

  const body = $('body').html();
  return body ?? html;
}
