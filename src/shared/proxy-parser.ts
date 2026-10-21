import type { ProxyScheme } from './types';
import type { CreateProxyInput } from './schemas';

/**
 * Parses multi-line proxy text in standard commercial formats into typed CreateProxyInput items.
 *
 * Supported formats per line:
 *  - host:port
 *  - host:port:username:password
 *  - username:password@host:port
 *  - scheme://host:port
 *  - scheme://username:password@host:port
 */
export function parseProxyList(raw: string, defaultScheme: ProxyScheme = 'http'): CreateProxyInput[] {
  const lines = raw.split(/\r?\n/);
  const result: CreateProxyInput[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    let scheme: ProxyScheme = defaultScheme;
    let username: string | null = null;
    let password: string | null = null;
    let host = '';
    let port = 0;

    // Check if line has scheme prefix (e.g. socks5:// or http://)
    const schemeMatch = line.match(/^([a-zA-Z0-9]+):\/\/(.*)$/);
    if (schemeMatch) {
      const parsedScheme = schemeMatch[1].toLowerCase();
      if (parsedScheme === 'http' || parsedScheme === 'https' || parsedScheme === 'socks5') {
        scheme = parsedScheme;
      }
      line = schemeMatch[2];
    }

    // Check if line has user:pass@host:port
    const authAtMatch = line.match(/^([^@]+)@([^@]+)$/);
    if (authAtMatch) {
      const authPart = authAtMatch[1];
      const hostPortPart = authAtMatch[2];

      const authSplit = authPart.split(':');
      username = authSplit[0] || null;
      password = authSplit.slice(1).join(':') || null;

      const hostPortSplit = hostPortPart.split(':');
      host = hostPortSplit[0];
      port = parseInt(hostPortSplit[1], 10);
    } else {
      // Colon-separated: host:port OR host:port:user:pass
      const parts = line.split(':');
      if (parts.length === 2) {
        host = parts[0];
        port = parseInt(parts[1], 10);
      } else if (parts.length >= 4) {
        host = parts[0];
        port = parseInt(parts[1], 10);
        username = parts[2] || null;
        password = parts.slice(3).join(':') || null;
      } else {
        continue;
      }
    }

    if (!host || isNaN(port) || port < 1 || port > 65535) {
      continue;
    }

    const name = `Proxy ${result.length + 1} (${host}:${port})`;

    result.push({
      name,
      scheme,
      host,
      port,
      username,
      password,
    });
  }

  return result;
}
