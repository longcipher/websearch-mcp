import TurndownService from 'turndown';

let turndownService: TurndownService | null = null;

function getTurndownService(): TurndownService {
  if (!turndownService) {
    turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
    });

    turndownService.remove('script');
    turndownService.remove('style');
    turndownService.remove('nav');
  }
  return turndownService;
}

export function htmlToMarkdown(html: string): string {
  const service = getTurndownService();
  return service.turndown(html);
}
