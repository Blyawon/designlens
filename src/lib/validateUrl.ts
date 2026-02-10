/* ---------------------------------------------------------------
   URL validation — block private IPs, enforce http(s)
   --------------------------------------------------------------- */

export function validateUrl(
  input: string
): { valid: boolean; url?: string; error?: string } {
  try {
    let urlStr = input.trim();
    if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
      urlStr = "https://" + urlStr;
    }

    const url = new URL(urlStr);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { valid: false, error: "Only regular web URLs (http/https) can be analysed." };
    }

    const hostname = url.hostname.toLowerCase();

    // Block obvious local hosts
    const blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"];
    if (blocked.includes(hostname)) {
      return { valid: false, error: "Local addresses like localhost can't be reached from our server." };
    }

    // Block private IPv4 ranges
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, aStr, bStr] = ipMatch;
      const a = Number(aStr);
      const b = Number(bStr);
      if (a === 10)
        return { valid: false, error: "That looks like an internal/private network address. Enter a publicly accessible URL." };
      if (a === 172 && b >= 16 && b <= 31)
        return { valid: false, error: "That looks like an internal/private network address. Enter a publicly accessible URL." };
      if (a === 192 && b === 168)
        return { valid: false, error: "That looks like an internal/private network address. Enter a publicly accessible URL." };
      if (a === 169 && b === 254)
        return { valid: false, error: "That looks like an internal/private network address. Enter a publicly accessible URL." };
    }

    return { valid: true, url: url.toString() };
  } catch {
    return { valid: false, error: "That doesn't look like a valid URL. Try something like https://example.com" };
  }
}
