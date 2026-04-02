import type { SearchResult } from '../schemas.js';

const TRUSTED_DOMAINS = new Map<string, number>([
  ['github.com', 5],
  ['stackoverflow.com', 5],
  ['developer.mozilla.org', 4],
  ['wikipedia.org', 4],
  ['docs.python.org', 3],
  ['nodejs.org', 3],
  ['rust-lang.org', 3],
  ['go.dev', 3],
  ['arxiv.org', 3],
  ['medium.com', 2],
  ['dev.to', 2],
]);

function getDomainBoost(hostname: string): number {
  for (const [domain, boost] of TRUSTED_DOMAINS) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return boost;
    }
  }
  return 0;
}

interface ScoredResult {
  result: SearchResult;
  score: number;
}

export function rankResults(results: SearchResult[]): SearchResult[] {
  const scored: ScoredResult[] = results.map((result, index) => {
    let score = 0;

    score += (result.source_providers.length - 1) * 2;

    score += Math.max(0, 10 - index);

    try {
      const hostname = new URL(result.url).hostname.toLowerCase();
      score += getDomainBoost(hostname);
    } catch {
      // invalid URL, no boost
    }

    return { result, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.result);
}
