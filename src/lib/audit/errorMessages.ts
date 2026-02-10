/* ---------------------------------------------------------------
   Error normaliser
   Translates cryptic Playwright/network errors into messages
   a normal human can actually understand and act on.
   --------------------------------------------------------------- */

interface ErrorPattern {
  /** Substring or regex to match against the raw error message */
  match: string | RegExp;
  /** The friendly message to show the user */
  message: string;
}

const patterns: ErrorPattern[] = [
  /* ---- DNS / connectivity ---- */
  {
    match: "ERR_NAME_NOT_RESOLVED",
    message: "We couldn't find that website. Double-check the URL for typos.",
  },
  {
    match: "ERR_CONNECTION_REFUSED",
    message: "The website refused the connection. It may be down or blocking automated requests.",
  },
  {
    match: "ERR_CONNECTION_RESET",
    message: "The connection was reset by the server. The site may be experiencing issues.",
  },
  {
    match: "ERR_CONNECTION_TIMED_OUT",
    message: "The website took too long to respond. It may be down or very slow.",
  },
  {
    match: "ERR_INTERNET_DISCONNECTED",
    message: "No internet connection. Check your network and try again.",
  },
  {
    match: "ERR_NETWORK_CHANGED",
    message: "Your network connection changed during the audit. Please try again.",
  },
  {
    match: "ERR_CONNECTION_CLOSED",
    message: "The website closed the connection unexpectedly. It may be blocking automated access.",
  },

  /* ---- SSL / TLS ---- */
  {
    match: "ERR_SSL_PROTOCOL_ERROR",
    message: "The website has an SSL/security configuration issue and can't be loaded securely.",
  },
  {
    match: "ERR_CERT",
    message: "The website's security certificate is invalid. We can't load it safely.",
  },
  {
    match: "ERR_SSL",
    message: "The website has an SSL error. Its security certificate may be expired or misconfigured.",
  },

  /* ---- HTTP errors ---- */
  {
    match: "ERR_TOO_MANY_REDIRECTS",
    message: "The website is stuck in a redirect loop and can't be loaded.",
  },
  {
    match: "ERR_INVALID_RESPONSE",
    message: "The website returned an invalid response. It may be misconfigured.",
  },
  {
    match: "ERR_ABORTED",
    message: "The page load was interrupted. The site may be redirecting or blocking access.",
  },
  {
    match: "ERR_BLOCKED_BY_RESPONSE",
    message: "The website blocked our request. It likely has strict security headers.",
  },
  {
    match: "ERR_EMPTY_RESPONSE",
    message: "The website returned an empty response. It may be down or blocking automated requests.",
  },

  /* ---- Playwright browser crashes ---- */
  {
    match: "Target page, context or browser has been closed",
    message: "The browser crashed while loading this page. The site may be too resource-heavy or is blocking headless browsers.",
  },
  {
    match: "Target closed",
    message: "The browser tab crashed while loading this page. Try a simpler URL.",
  },
  {
    match: "Browser has been closed",
    message: "The browser process ended unexpectedly. This usually means the page used too much memory.",
  },
  {
    match: "Protocol error",
    message: "Lost connection to the browser engine. The page may have caused it to crash.",
  },
  {
    match: "Navigation interrupted",
    message: "The page navigation was interrupted, likely by a redirect or popup.",
  },
  {
    match: /Navigation.+timeout/i,
    message: "The page took too long to load. It may be very heavy or depend on resources that are slow to respond.",
  },
  {
    match: /Timeout.*exceeded/i,
    message: "The operation timed out. The target site is too slow to respond within our time limit.",
  },

  /* ---- Bot detection (already has a good message, but just in case) ---- */
  {
    match: "bot detection",
    message: "This site uses bot protection (like Cloudflare or CAPTCHA) that blocks our analysis. Try a staging URL or a site without anti-bot measures.",
  },

  /* ---- Memory ---- */
  {
    match: "out of memory",
    message: "The page used too much memory to analyse. Try a simpler page.",
  },
  {
    match: "OOM",
    message: "The page used too much memory to analyse. Try a simpler page.",
  },
];

/**
 * Takes a raw error (from Playwright, network, etc.) and returns
 * a clear, user-friendly message. Falls back to a generic message
 * if no pattern matches.
 */
export function normalizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  for (const p of patterns) {
    if (typeof p.match === "string") {
      if (raw.includes(p.match)) return p.message;
    } else {
      if (p.match.test(raw)) return p.message;
    }
  }

  /* If nothing matched, clean up the raw message a bit:
     strip Playwright internal prefixes and limit length. */
  const cleaned = raw
    .replace(/^page\.\w+:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .slice(0, 200);

  if (cleaned.length > 0 && cleaned !== "undefined") {
    return `Something went wrong while analysing this site: ${cleaned}`;
  }

  return "An unexpected error occurred during the audit. Please try again, or try a different URL.";
}
