import { describe, expect, it, vi } from 'vitest';
import { SecurityBlockError } from '../errors.js';
import {
  type DnsLookupFn,
  isIpLiteral,
  resolveAndValidateUrl,
  validateUrl,
} from '../security/url-policy.js';

describe('validateUrl', () => {
  describe('valid public URLs (allowPrivateNetwork=false)', () => {
    it('accepts https URL with path', () => {
      const result = validateUrl('https://example.com/path', false);
      expect(result.hostname).toBe('example.com');
      expect(result.pathname).toBe('/path');
    });

    it('accepts http URL without path', () => {
      const result = validateUrl('http://example.com', false);
      expect(result.hostname).toBe('example.com');
    });

    it('accepts https URL with nested path', () => {
      const result = validateUrl('https://github.com/issues/123', false);
      expect(result.hostname).toBe('github.com');
      expect(result.pathname).toBe('/issues/123');
    });

    it('accepts https URL with long path', () => {
      const result = validateUrl('https://stackoverflow.com/questions/456', false);
      expect(result.hostname).toBe('stackoverflow.com');
    });
  });

  describe('private/loopback addresses (allowPrivateNetwork=false)', () => {
    it('blocks IPv4 loopback', () => {
      expect(() => validateUrl('http://127.0.0.1:3000', false)).toThrow(SecurityBlockError);
    });

    it('blocks localhost by name', () => {
      expect(() => validateUrl('http://localhost:3000', false)).toThrow(SecurityBlockError);
    });

    it('blocks 10.0.0.0/8 private range', () => {
      expect(() => validateUrl('http://10.0.0.1', false)).toThrow(SecurityBlockError);
    });

    it('blocks 192.168.0.0/16 private range', () => {
      expect(() => validateUrl('http://192.168.1.1', false)).toThrow(SecurityBlockError);
    });

    it('blocks 172.16.0.0/12 private range', () => {
      expect(() => validateUrl('http://172.16.0.1', false)).toThrow(SecurityBlockError);
    });

    it('blocks 172.31.255.255 private boundary', () => {
      expect(() => validateUrl('http://172.31.255.255', false)).toThrow(SecurityBlockError);
    });

    it('blocks 169.254.0.0/16 link-local', () => {
      expect(() => validateUrl('http://169.254.0.1', false)).toThrow(SecurityBlockError);
    });

    it('blocks IPv6 loopback', () => {
      expect(() => validateUrl('http://[::1]:3000', false)).toThrow(SecurityBlockError);
    });

    it('blocks IPv6 link-local', () => {
      expect(() => validateUrl('http://[fe80::1]', false)).toThrow(SecurityBlockError);
    });

    it('blocks IPv6 ULA/private', () => {
      expect(() => validateUrl('http://[fd00::1]', false)).toThrow(SecurityBlockError);
    });
  });

  describe('non-HTTP schemes (allowPrivateNetwork=false)', () => {
    it('blocks file:// scheme', () => {
      expect(() => validateUrl('file:///etc/passwd', false)).toThrow(SecurityBlockError);
    });

    it('blocks ftp:// scheme', () => {
      expect(() => validateUrl('ftp://example.com/file', false)).toThrow(SecurityBlockError);
    });

    it('blocks javascript: scheme', () => {
      expect(() => validateUrl('javascript:alert(1)', false)).toThrow(SecurityBlockError);
    });
  });

  describe('private network escape hatch', () => {
    it('allows loopback when allowPrivateNetwork=true', () => {
      const result = validateUrl('http://127.0.0.1:3000', true);
      expect(result.hostname).toBe('127.0.0.1');
    });

    it('allows localhost when allowPrivateNetwork=true', () => {
      const result = validateUrl('http://localhost:3000', true);
      expect(result.hostname).toBe('localhost');
    });

    it('allows private IPv4 when allowPrivateNetwork=true', () => {
      const result = validateUrl('http://192.168.1.1', true);
      expect(result.hostname).toBe('192.168.1.1');
    });
  });

  describe('SecurityBlockError details', () => {
    it('includes descriptive message for blocked scheme', () => {
      try {
        validateUrl('file:///etc/passwd', false);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityBlockError);
        expect((error as SecurityBlockError).message).toContain('file:');
      }
    });

    it('includes descriptive message for blocked host', () => {
      try {
        validateUrl('http://127.0.0.1', false);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityBlockError);
        expect((error as SecurityBlockError).message).toContain('127.0.0.1');
      }
    });

    it('includes code SECURITY_BLOCK', () => {
      try {
        validateUrl('http://10.0.0.1', false);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as SecurityBlockError).code).toBe('SECURITY_BLOCK');
      }
    });
  });
});

describe('isIpLiteral', () => {
  it('returns true for IPv4 addresses', () => {
    expect(isIpLiteral('127.0.0.1')).toBe(true);
    expect(isIpLiteral('8.8.8.8')).toBe(true);
  });

  it('returns true for bracketed IPv6 addresses', () => {
    expect(isIpLiteral('[::1]')).toBe(true);
    expect(isIpLiteral('[2001:db8::1]')).toBe(true);
  });

  it('returns true for unbracketed IPv6 with colons', () => {
    expect(isIpLiteral('::1')).toBe(true);
    expect(isIpLiteral('2001:db8::1')).toBe(true);
  });

  it('returns false for hostnames', () => {
    expect(isIpLiteral('example.com')).toBe(false);
    expect(isIpLiteral('localhost')).toBe(false);
    expect(isIpLiteral('sub.domain.example.org')).toBe(false);
  });
});

describe('resolveAndValidateUrl', () => {
  it('rejects hostnames that resolve to private IPs', async () => {
    const mockLookup: DnsLookupFn = vi
      .fn()
      .mockResolvedValue([{ address: '192.168.1.100', family: 4, ttl: 0 }]);

    await expect(
      resolveAndValidateUrl('https://evil.example.com/path', false, mockLookup),
    ).rejects.toThrow(SecurityBlockError);
  });

  it('rejects hostnames that resolve to loopback IPs', async () => {
    const mockLookup: DnsLookupFn = vi
      .fn()
      .mockResolvedValue([{ address: '127.0.0.1', family: 4, ttl: 0 }]);

    await expect(
      resolveAndValidateUrl('https://evil.example.com', false, mockLookup),
    ).rejects.toThrow(SecurityBlockError);
  });

  it('rejects hostnames that resolve to private IPv6 IPs', async () => {
    const mockLookup: DnsLookupFn = vi
      .fn()
      .mockResolvedValue([{ address: '::1', family: 6, ttl: 0 }]);

    await expect(
      resolveAndValidateUrl('https://evil.example.com', false, mockLookup),
    ).rejects.toThrow(SecurityBlockError);
  });

  it('rejects if any resolved IP is private (mixed results)', async () => {
    const mockLookup: DnsLookupFn = vi.fn().mockResolvedValue([
      { address: '8.8.8.8', family: 4, ttl: 0 },
      { address: '10.0.0.1', family: 4, ttl: 0 },
    ]);

    await expect(
      resolveAndValidateUrl('https://evil.example.com', false, mockLookup),
    ).rejects.toThrow(SecurityBlockError);
  });

  it('accepts hostnames resolving to public IPs', async () => {
    const mockLookup: DnsLookupFn = vi.fn().mockResolvedValue([
      { address: '8.8.8.8', family: 4, ttl: 0 },
      { address: '8.8.4.4', family: 4, ttl: 0 },
    ]);

    const result = await resolveAndValidateUrl('https://dns.google', false, mockLookup);
    expect(result.hostname).toBe('dns.google');
  });

  it('skips DNS validation for IP literals (IPv4)', async () => {
    const mockLookup: DnsLookupFn = vi.fn();

    const result = await resolveAndValidateUrl('https://8.8.8.8', false, mockLookup);
    expect(result.hostname).toBe('8.8.8.8');
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('skips DNS validation for IP literals (IPv6 bracketed)', async () => {
    const mockLookup: DnsLookupFn = vi.fn();

    const result = await resolveAndValidateUrl('https://[2001:db8::1]', false, mockLookup);
    expect(result.hostname).toBe('[2001:db8::1]');
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('skips DNS validation when allowPrivateNetwork is true', async () => {
    const mockLookup: DnsLookupFn = vi.fn();

    const result = await resolveAndValidateUrl('https://example.com', true, mockLookup);
    expect(result.hostname).toBe('example.com');
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('rejects unresolvable hostnames', async () => {
    const mockLookup: DnsLookupFn = vi.fn().mockResolvedValue([]);

    await expect(
      resolveAndValidateUrl('https://nonexistent.invalid', false, mockLookup),
    ).rejects.toThrow(SecurityBlockError);
  });

  it('rejects when DNS lookup throws', async () => {
    const mockLookup: DnsLookupFn = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));

    await expect(
      resolveAndValidateUrl('https://nonexistent.invalid', false, mockLookup),
    ).rejects.toThrow(SecurityBlockError);
  });

  it('re-throws SecurityBlockError from validateUrl for invalid URLs', async () => {
    const mockLookup: DnsLookupFn = vi.fn();

    await expect(resolveAndValidateUrl('not-a-url', false, mockLookup)).rejects.toThrow(
      SecurityBlockError,
    );
  });

  it('re-throws SecurityBlockError from validateUrl for private IP literals', async () => {
    const mockLookup: DnsLookupFn = vi.fn();

    await expect(resolveAndValidateUrl('http://127.0.0.1', false, mockLookup)).rejects.toThrow(
      SecurityBlockError,
    );
  });
});
