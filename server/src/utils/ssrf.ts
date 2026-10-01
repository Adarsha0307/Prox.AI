import { lookup } from 'dns/promises';
import ipaddr from 'ipaddr.js';

export async function validateSafeUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (err) {
    throw new Error('Invalid URL format');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`SSRF blocked: Unsupported protocol ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new Error('SSRF blocked: URL credentials are not allowed');
  }

  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  if (port !== '80' && port !== '443') {
    throw new Error(`SSRF blocked: Unsupported port ${port}`);
  }

  const records = await lookup(url.hostname, { all: false });
  const ip = records.address;

  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(ip);
  } catch (err) {
    throw new Error('SSRF blocked: Invalid IP resolution');
  }

  const range = parsed.range();
  const blockedRanges = [
    'unspecified',
    'broadcast',
    'multicast',
    'linkLocal',
    'loopback',
    'private',
    'carrierGradeNat',
    'reserved',
  ];

  if (blockedRanges.includes(range)) {
    throw new Error(`SSRF blocked: Resolved IP (${ip}) is in a blocked range (${range})`);
  }

  if (ip === '169.254.169.254' || ip === '::ffff:169.254.169.254') {
    throw new Error('SSRF blocked: Cloud metadata IP detected');
  }

  return url;
}
