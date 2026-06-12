/* ---------------------------------------------------------------
   SSRF guard — server-only helpers shared by URL validation and
   the Playwright request interceptor.

   Two layers:
   1. isPrivateIp / isBlockedHostname — pure, synchronous checks
      for IP literals and obviously-local hostnames.
   2. hostIsBlocked — resolves a hostname via DNS and rejects it
      when any resolved address falls in a private/special range.
      Results are cached briefly so the per-request Playwright
      interceptor only pays for one lookup per host.
   --------------------------------------------------------------- */

import { lookup } from "node:dns/promises";

/* ---- IPv4 ---- */

export function isPrivateIPv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return (
    a === 0 ||                              // 0.0.0.0/8 — "this network"
    a === 10 ||                             // 10.0.0.0/8
    a === 127 ||                            // 127.0.0.0/8 loopback
    (a === 100 && b >= 64 && b <= 127) ||   // 100.64.0.0/10 CGNAT
    (a === 169 && b === 254) ||             // 169.254.0.0/16 link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||    // 172.16.0.0/12
    (a === 192 && b === 0 && c === 0) ||    // 192.0.0.0/24 IETF protocol assignments
    (a === 192 && b === 168) ||             // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) ||// 198.18.0.0/15 benchmarking
    a >= 224                                // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  );
}

/* ---- IPv6 ---- */

export function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (addr === "::" || addr === "::1") return true;            // unspecified / loopback
  if (/^fe[89ab]/.test(addr)) return true;                     // fe80::/10 link-local
  if (/^f[cd]/.test(addr)) return true;                        // fc00::/7 unique-local
  if (addr.startsWith("64:ff9b:")) return true;                // NAT64 — may embed private v4

  /* IPv4-mapped (::ffff:a.b.c.d or ::ffff:hex:hex) — check the embedded v4 */
  const mapped = addr.match(/^::ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1];
    if (tail.includes(".")) return isPrivateIPv4(tail);
    const words = tail.split(":");
    if (words.length === 2) {
      const hi = parseInt(words[0], 16);
      const lo = parseInt(words[1], 16);
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        return isPrivateIPv4(
          `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
        );
      }
    }
    return true; // unparseable mapped form — be safe
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "");
  if (bare.includes(":")) return isPrivateIPv6(bare);
  return isPrivateIPv4(bare);
}

/* ---- hostname-level sync checks ---- */

export function isBlockedHostname(hostname: string): boolean {
  /* normalise: lowercase, strip brackets and trailing dot ("localhost.") */
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (host === "" || host === "localhost" || host.endsWith(".localhost")) return true;
  /* mDNS and cloud-internal suffixes never point at the public internet */
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  return isPrivateIp(host);
}

/* ---- async DNS check with a short cache ---- */

const CACHE_TTL_MS = 60_000;
const dnsCache = new Map<string, { at: number; blocked: boolean }>();

/**
 * True when the hostname is a private IP literal, a local name, or
 * resolves (A/AAAA) to any private/special address. DNS failures
 * return false — the browser will surface its own error for those.
 */
export async function hostIsBlocked(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (isBlockedHostname(host)) return true;

  const cached = dnsCache.get(host);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.blocked;

  let blocked = false;
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    blocked = addrs.some((a) => isPrivateIp(a.address));
  } catch {
    blocked = false;
  }

  if (dnsCache.size > 1000) dnsCache.clear();
  dnsCache.set(host, { at: Date.now(), blocked });
  return blocked;
}
