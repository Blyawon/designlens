/* ---------------------------------------------------------------
   URL validation — enforce http(s), reject credentials, and block
   local/private hosts (sync checks; the API route additionally
   verifies DNS resolution via hostIsBlocked before auditing).
   --------------------------------------------------------------- */

import { isBlockedHostname } from "./ssrf";

const PRIVATE_ERROR =
  "That looks like an internal/private network address. Enter a publicly accessible URL.";

export function validateUrl(
  input: string
): { valid: boolean; url?: string; error?: string } {
  try {
    let urlStr = input.trim();
    /* Only prepend https:// when there's no scheme at all — prefixing
       "ftp://x.com" would otherwise mangle it into "https://ftp//x.com"
       instead of rejecting it with a clear message below. */
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(urlStr)) {
      urlStr = "https://" + urlStr;
    }

    const url = new URL(urlStr);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { valid: false, error: "Only regular web URLs (http/https) can be analysed." };
    }

    /* Embedded credentials are never needed for a public page and can
       be abused to confuse downstream URL parsing. */
    if (url.username || url.password) {
      return { valid: false, error: "URLs with embedded credentials can't be analysed." };
    }

    if (isBlockedHostname(url.hostname)) {
      return { valid: false, error: PRIVATE_ERROR };
    }

    /* Single-label hostnames ("intranet", "router") are either typos or
       internal names that only resolve via private DNS search suffixes. */
    const bareHost = url.hostname.replace(/\.$/, "");
    if (!bareHost.includes(".") && !bareHost.includes(":")) {
      return { valid: false, error: "That doesn't look like a valid public URL. Try something like https://example.com" };
    }

    return { valid: true, url: url.toString() };
  } catch {
    return { valid: false, error: "That doesn't look like a valid URL. Try something like https://example.com" };
  }
}
