import dns from 'dns/promises';
import http from 'http';
import https from 'https';

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'instance-data',
  '169.254.169.254',
]);

function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true; // 10.0.0.0/8
    if (parts[0] === 127) return true; // 127.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 (Link Local / Cloud Metadata)
    if (parts[0] === 0) return true; // 0.0.0.0/8
  }

  // IPv6 check
  if (ip === '::1' || ip.toLowerCase().startsWith('fe80:') || ip.toLowerCase().startsWith('fc00:')) {
    return true;
  }

  return false;
}

export async function validateUrlForSsrf(urlString: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch (err) {
    throw new Error('INVALID_URL: The provided string is not a valid URL.');
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('INVALID_PROTOCOL: Only HTTP and HTTPS URLs are permitted.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Hostname blocklist
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    throw new Error('SSRF_PROTECTION: Requests to local or internal metadata addresses are blocked.');
  }

  // DNS Resolution check
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new Error(`SSRF_PROTECTION: Host resolves to private or restricted network address (${addr.address}).`);
      }
    }
  } catch (err: any) {
    if (err.message.includes('SSRF_PROTECTION')) throw err;
    throw new Error(`DNS_RESOLUTION_FAILED: Could not resolve hostname '${hostname}'.`);
  }

  return parsed;
}

export async function safeFetchHtml(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FunclubSIMetadataBot/2.0; +https://funclubsi.com)',
        'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}: Target website responded with status ${response.status}.`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('application/json')) {
      throw new Error('INVALID_CONTENT_TYPE: Remote resource must be HTML or JSON metadata.');
    }

    // Limit maximum response size to 2MB
    const text = await response.text();
    if (text.length > 2 * 1024 * 1024) {
      return text.slice(0, 2 * 1024 * 1024);
    }
    return text;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('REQUEST_TIMEOUT: Target website timed out after 8 seconds.');
    }
    throw err;
  }
}
