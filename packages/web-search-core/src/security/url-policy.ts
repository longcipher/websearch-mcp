import { SecurityBlockError } from '../errors.js';

const PRIVATE_RANGES: Array<{ prefix: string; bits: number }> = [
  { prefix: '10.0.0.0', bits: 8 },
  { prefix: '172.16.0.0', bits: 12 },
  { prefix: '192.168.0.0', bits: 16 },
  { prefix: '127.0.0.0', bits: 8 },
  { prefix: '169.254.0.0', bits: 16 },
  { prefix: '0.0.0.0', bits: 8 },
];

const PRIVATE_V6_RANGES: Array<{ prefix: string; bits: number }> = [
  { prefix: '::1', bits: 128 },
  { prefix: 'fc00::', bits: 7 },
  { prefix: 'fe80::', bits: 10 },
  { prefix: '::ffff:10.0.0.0', bits: 104 },
  { prefix: '::ffff:172.16.0.0', bits: 108 },
  { prefix: '::ffff:192.168.0.0', bits: 112 },
  { prefix: '::ffff:127.0.0.0', bits: 104 },
];

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const octet = Number.parseInt(part, 10);
    if (Number.isNaN(octet) || octet < 0 || octet > 255) return null;
    result = (result << 8) | octet;
  }
  return result >>> 0;
}

function matchesIpv4Range(ip: string, prefix: string, bits: number): boolean {
  const ipNum = ipToNumber(ip);
  const prefixNum = ipToNumber(prefix);
  if (ipNum === null || prefixNum === null) return false;
  const mask = bits === 32 ? 0xffffffff : ~(0xffffffff >>> bits) >>> 0;
  return (ipNum & mask) === (prefixNum & mask);
}

function expandIpv6(addr: string): string[] {
  if (addr.includes('::')) {
    const parts = addr.split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    const middle = Array.from({ length: Math.max(0, missing) }, () => '0');
    const full = [...left, ...middle, ...right];
    return full.map((g) => g.padStart(4, '0'));
  }
  return addr.split(':').map((g) => g.padStart(4, '0'));
}

function ipv6ToHexGroups(addr: string): string[] {
  return expandIpv6(addr);
}

function matchesIpv6Range(ip: string, prefix: string, bits: number): boolean {
  const ipGroups = ipv6ToHexGroups(ip);
  const prefixGroups = ipv6ToHexGroups(prefix);
  if (ipGroups.length !== 8 || prefixGroups.length !== 8) return false;

  let remainingBits = bits;
  for (let i = 0; i < 8 && remainingBits > 0; i++) {
    const ipGroup = ipGroups[i];
    const prefixGroup = prefixGroups[i];
    if (!ipGroup || !prefixGroup) return false;
    const bitsInGroup = Math.min(remainingBits, 16);
    const mask = bitsInGroup === 16 ? 0xffff : (0xffff << (16 - bitsInGroup)) & 0xffff;
    const ipVal = Number.parseInt(ipGroup, 16);
    const prefixVal = Number.parseInt(prefixGroup, 16);
    if ((ipVal & mask) !== (prefixVal & mask)) return false;
    remainingBits -= 16;
  }
  return true;
}

function isPrivateIpv4(hostname: string): boolean {
  for (const range of PRIVATE_RANGES) {
    if (matchesIpv4Range(hostname, range.prefix, range.bits)) return true;
  }
  return false;
}

function isPrivateIpv6(hostname: string): {
  result: boolean;
  matched: boolean;
} {
  const clean = hostname.replace(/^\[|\]$/g, '');
  for (const range of PRIVATE_V6_RANGES) {
    if (matchesIpv6Range(clean, range.prefix, range.bits)) return { result: true, matched: true };
  }
  return { result: false, matched: true };
}

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  if (isPrivateIpv4(hostname)) return true;
  const ipv6 = isPrivateIpv6(hostname);
  if (ipv6.matched && ipv6.result) return true;
  return false;
}

export function validateUrl(urlString: string, allowPrivateNetwork: boolean): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new SecurityBlockError(`Invalid URL: ${urlString}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SecurityBlockError(
      `Blocked scheme "${url.protocol}" — only http: and https: are allowed`,
    );
  }

  if (!allowPrivateNetwork && isPrivateHost(url.hostname)) {
    throw new SecurityBlockError(
      `Blocked private/loopback address "${url.hostname}" — set allowPrivateNetwork to override`,
    );
  }

  return url;
}

export function isIpLiteral(hostname: string): boolean {
  return /^[\d.]+$/.test(hostname) || /^\[.*\]$/.test(hostname) || hostname.includes(':');
}

export type DnsLookupFn = (
  hostname: string,
) => Promise<{ address: string; family: 4 | 6; ttl: number }[]>;

export async function resolveAndValidateUrl(
  urlString: string,
  allowPrivateNetwork: boolean,
  dnsLookup?: DnsLookupFn,
): Promise<URL> {
  const url = validateUrl(urlString, allowPrivateNetwork);

  if (allowPrivateNetwork) return url;

  const hostname = url.hostname;

  if (isIpLiteral(hostname)) return url;

  const lookup = dnsLookup ?? Bun.dns.lookup.bind(Bun.dns);

  try {
    const results = await lookup(hostname);
    const resolved = results.map((r) => r.address);

    if (resolved.length === 0) {
      throw new SecurityBlockError(`Could not resolve hostname: ${hostname}`);
    }

    for (const ip of resolved) {
      if (isPrivateIpv4(ip)) {
        throw new SecurityBlockError(
          `DNS rebinding protection: ${hostname} resolves to private IP ${ip}`,
        );
      }
      const ipv6Check = isPrivateIpv6(ip);
      if (ipv6Check.matched && ipv6Check.result) {
        throw new SecurityBlockError(
          `DNS rebinding protection: ${hostname} resolves to private IPv6 ${ip}`,
        );
      }
    }

    return url;
  } catch (error) {
    if (error instanceof SecurityBlockError) throw error;
    throw new SecurityBlockError(
      `DNS resolution failed for ${hostname}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
