const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'ref',
  'spm',
]);

export function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);

    url.hostname = url.hostname.toLowerCase();
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
    }

    const trackingKeys: string[] = [];
    url.searchParams.forEach((_value, key) => {
      if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) {
        trackingKeys.push(key);
      }
    });
    for (const key of trackingKeys) {
      url.searchParams.delete(key);
    }

    url.hash = '';

    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return urlString;
  }
}
