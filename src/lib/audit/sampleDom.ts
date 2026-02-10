/* ---------------------------------------------------------------
   DOM sampling via Playwright
   Loads a page, collects computed styles from text elements and
   layout elements in a single page.evaluate pass.
   Also takes a screenshot for annotation overlay.

   Performance-optimised:
   - Hardcoded waitForTimeout calls replaced with smart waits
   - Cookie dismissal consolidated into a single pass
   - Browser launch args tuned for speed
   - Scroll depth capped to avoid triggering excessive lazy-load
   - DOM scanning limits tightened
   - AbortSignal support for early cancellation
   --------------------------------------------------------------- */

import { chromium, Browser } from "playwright-core";
import { SampledElement, SampleResult, ProgressCallback, CSSToken } from "./types";

const TEXT_SELECTORS = [
  "p","span","a","li","button","input","label","th","td",
  "h1","h2","h3","h4","h5","h6","dt","dd","figcaption",
  "blockquote","code","pre","em","strong","b","i","small",
].join(",");

/* Reduced caps — fewer elements = faster analysis without
   meaningful loss of signal (diminishing returns past ~1200) */
const MAX_TEXT_DEFAULT = 1500;
const MAX_LAYOUT_DEFAULT = 2000;

/* Aggressive mode caps — used on retry after a crash */
const MAX_TEXT_AGGRESSIVE = 800;
const MAX_LAYOUT_AGGRESSIVE = 1000;

/* Max pixel depth to scroll when triggering lazy content.
   Prevents us from loading an infinite-scroll page's entire feed. */
const MAX_SCROLL_DEPTH = 4000;

/* Max screenshot height in px. Caps memory usage on tall pages. */
const MAX_SCREENSHOT_HEIGHT = 5000;

export async function sampleDom(
  url: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<SampleResult> {
  /* Retry wrapper — browser crashes are often non-deterministic.
     A single retry with more aggressive resource blocking catches
     most flaky OOM cases. */
  try {
    return await sampleDomOnce(url, onProgress, signal, false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isCrash =
      msg.includes("Target page, context or browser has been closed") ||
      msg.includes("Target closed") ||
      msg.includes("Browser has been closed") ||
      msg.includes("Protocol error") ||
      msg.includes("crashed");
    if (!isCrash || signal?.aborted) throw err;
    /* One retry with aggressive resource blocking */
    onProgress?.({ phase: "retrying", message: "Browser crashed — retrying with lighter settings…" });
    return await sampleDomOnce(url, onProgress, signal, true);
  }
}

async function sampleDomOnce(
  url: string,
  onProgress: ProgressCallback | undefined,
  signal: AbortSignal | undefined,
  aggressiveMode: boolean
): Promise<SampleResult> {
  let browser: Browser | null = null;

  /* Utility: check if we should bail out early (abort or crash) */
  function checkAbort() {
    if (signal?.aborted) {
      throw new DOMException("Audit cancelled", "AbortError");
    }
    if (pageCrashed) {
      throw new Error("Target page, context or browser has been closed");
    }
  }

  /* Declared here, assigned after page is created */
  let pageCrashed = false;

  try {
    onProgress?.({ phase: "launching", message: "Launching browser…" });

    const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

    /* Common performance args that speed up headless Chrome.
       Disabling features we don't need shaves ~1-2s off launch. */
    const perfArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",         // avoid /dev/shm issues in containers
      "--disable-accelerated-2d-canvas",
      "--disable-canvas-aa",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-extensions",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--metrics-recording-only",
      "--no-first-run",
      "--mute-audio",
      "--hide-scrollbars",
      "--disk-cache-size=0",
      /* Additional stability/memory args */
      "--disable-webgl",                  // WebGL can crash the GPU process even with --disable-gpu
      "--disable-webgl2",
      "--disable-software-rasterizer",    // no fallback software rendering
      "--disable-ipc-flooding-protection",
      "--disable-component-update",
      "--disable-domain-reliability",
      "--disable-print-preview",
      "--disable-speech-api",
      /* NOTE: --single-process and --no-zygote removed intentionally.
         They reduce memory but make Chromium extremely crash-prone
         because one renderer failure kills the entire browser process.
         Better to use more memory than to crash on every heavy page. */
      ...(isServerless ? [
        "--disable-features=IsolateOrigins,site-per-process",
        "--js-flags=--max-old-space-size=512", // cap V8 heap — 512MB leaves room for the rest
      ] : []),
    ];

    if (isServerless) {
      const sparticuzChromium = (await import("@sparticuz/chromium")).default;
      browser = await chromium.launch({
        args: [...sparticuzChromium.args, ...perfArgs],
        executablePath: await sparticuzChromium.executablePath(),
        headless: true,
      });
    } else {
      browser = await chromium.launch({
        headless: true,
        args: perfArgs,
      });
    }

    checkAbort();

    /* Aggressive mode: smaller viewport + disable JS.
       Most modern sites SSR their HTML/CSS, so we still get valid
       computed styles without executing any client-side JavaScript.
       This is the single biggest memory saving — heavy SPAs can
       allocate 500MB+ just in JS heap. */
    const VIEWPORT_WIDTH = aggressiveMode ? 1024 : 1280;
    const VIEWPORT_HEIGHT = aggressiveMode ? 600 : (isServerless ? 720 : 900);

    const page = await browser.newPage({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      javaScriptEnabled: !aggressiveMode,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    /* Shorter default timeout — fail fast rather than hang */
    page.setDefaultTimeout(aggressiveMode ? 15_000 : (isServerless ? 20_000 : 30_000));

    /* Block heavy resources to save memory.
       Normal serverless: block images, media, fonts (we only need DOM + stylesheets).
       Aggressive (retry): also block scripts, iframes, and other heavy fetches.
       Locally: keep fonts + images for screenshots / font specimens, block media. */
    const blockTypes: string[] = aggressiveMode
      ? ["media", "image", "font", "script", "other"]
      : isServerless
        ? ["media", "image", "font"]
        : ["media"];

    /* In aggressive mode, also block known heavy third-party domains */
    const blockDomains = aggressiveMode
      ? [
          "googletagmanager.com", "google-analytics.com", "analytics.",
          "facebook.net", "doubleclick.net", "ads.", "adservice.",
          "hotjar.com", "intercom.io", "segment.com", "sentry.io",
          "fullstory.com", "mixpanel.com", "amplitude.com",
          "youtube.com", "vimeo.com", "player.",
        ]
      : [];

    await page.route("**/*", (route) => {
      const req = route.request();
      const type = req.resourceType();
      if (blockTypes.includes(type)) return route.abort();
      if (blockDomains.length > 0) {
        const reqUrl = req.url().toLowerCase();
        if (blockDomains.some((d) => reqUrl.includes(d))) return route.abort();
      }
      return route.continue();
    });

    /* Listen for page crashes — sets the flag that checkAbort() reads,
       so the next checkpoint throws immediately instead of hanging */
    page.on("crash", () => { pageCrashed = true; });

    checkAbort();
    onProgress?.({ phase: "loading", message: `Loading ${url}…` });

    /* Navigate — use "domcontentloaded" instead of "load".
       "load" waits for ALL sub-resources (images, iframes, ads).
       "domcontentloaded" fires when HTML is parsed and deferred scripts run,
       which is all we need since we sample computed styles. */
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error && err.message.includes("Timeout");
      if (!isTimeout) throw err;
      onProgress?.({
        phase: "loading",
        message: "Page still loading resources — proceeding with what we have…",
      });
    }

    checkAbort();
    onProgress?.({ phase: "waiting", message: "Waiting for page to render…" });

    /* Wait for enough text elements to appear, with a shorter timeout.
       5s is plenty for well-built sites; slow ones we proceed anyway. */
    await page
      .waitForFunction(
        (sel: string) => document.querySelectorAll(sel).length > 10,
        TEXT_SELECTORS,
        { timeout: 5_000 }
      )
      .catch(() => {});

    /* ---- Cookie consent dismissal (single consolidated pass) ----
       Click first, then if nothing was clicked, force-hide overlays.
       We do this ONCE instead of the previous twice. */
    try {
      const consentClicked = await page.evaluate(() => {
        const patterns = [
          'button[id*="accept" i]', 'button[id*="consent" i]',
          'button[id*="agree" i]', 'button[id*="allow" i]',
          'button[class*="accept" i]', 'button[class*="consent" i]',
          'button[class*="agree" i]', 'button[class*="allow" i]',
          'a[id*="accept" i]', 'a[class*="accept" i]',
          '[class*="cookie"] button', '[class*="consent"] button',
          '[id*="cookie"] button', '[id*="consent"] button',
          '[data-testid*="accept" i]', '[data-testid*="consent" i]',
          '[aria-label*="accept" i]', '[aria-label*="consent" i]',
          '[aria-label*="cookie" i]',
        ];
        for (const sel of patterns) {
          const btn = document.querySelector<HTMLElement>(sel);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (consentClicked) {
        /* Wait briefly for the banner to dismiss. Instead of a blind 2s,
           wait for layout to settle (max 800ms). */
        await page.waitForTimeout(800);
      } else {
        /* Force-hide cookie/consent overlays via CSS */
        await page.evaluate(() => {
          const overlayPatterns = [
            '[class*="cookie" i]', '[class*="consent" i]',
            '[id*="cookie" i]', '[id*="consent" i]',
            '[class*="CookieBanner" i]', '[class*="cookie-banner" i]',
            '[class*="gdpr" i]', '[id*="gdpr" i]',
            '[class*="onetrust" i]', '[id*="onetrust" i]',
            '[class*="cc-banner" i]', '[class*="cc_banner" i]',
            '[id*="CybotCookiebot" i]',
            '[class*="sp_message" i]',
          ];
          for (const sel of overlayPatterns) {
            document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
              const cs = window.getComputedStyle(el);
              const isOverlay =
                el.getBoundingClientRect().width > window.innerWidth * 0.5 ||
                cs.position === "fixed" || cs.position === "sticky";
              if (isOverlay) el.style.display = "none";
            });
          }
        });
      }
    } catch {
      /* consent dismissal is best-effort */
    }

    checkAbort();

    /* Scroll page to trigger lazy-rendered content, capped at scroll depth.
       In aggressive mode, skip scrolling entirely — it loads more content
       which is the #1 cause of OOM on heavy sites. */
    const scrollDepth = aggressiveMode ? 0 : MAX_SCROLL_DEPTH;
    const scrollTarget = await page.evaluate(
      (maxDepth: number) => Math.min(document.body.scrollHeight, maxDepth),
      scrollDepth
    );
    await page.evaluate((target: number) => window.scrollTo(0, target), scrollTarget);
    /* Use waitForFunction instead of blind waitForTimeout — waits until
       new DOM content appears or 1s max, whichever comes first. */
    await page
      .waitForFunction(
        (sel: string) => document.querySelectorAll(sel).length > 20,
        TEXT_SELECTORS,
        { timeout: 1_000 }
      )
      .catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    /* Tiny settle (replaces old 500ms wait) */
    await page.waitForTimeout(200);

    checkAbort();
    onProgress?.({ phase: "sampling", message: "Sampling DOM elements…" });

    /* ---- single evaluate pass inside browser context ---- */
    const samples: SampledElement[] = await page.evaluate(
      ({ textSel, maxText, maxLayout }: { textSel: string; maxText: number; maxLayout: number }) => {

        function getRegion(el: Element): string {
          let cur: Element | null = el;
          while (cur) {
            const tag = cur.tagName.toLowerCase();
            if (["header", "nav", "main", "footer", "aside", "section"].includes(tag)) return tag;
            const role = cur.getAttribute("role");
            if (role === "banner") return "header";
            if (role === "navigation") return "nav";
            if (role === "main") return "main";
            if (role === "contentinfo") return "footer";
            const id = (cur.id || "").toLowerCase();
            const cls =
              typeof cur.className === "string"
                ? cur.className.toLowerCase()
                : "";
            if (id.includes("header") || cls.includes("header")) return "header";
            if (id.includes("footer") || cls.includes("footer")) return "footer";
            if (id.includes("nav") || cls.includes("nav")) return "nav";
            if (id.includes("sidebar") || cls.includes("sidebar")) return "aside";
            cur = cur.parentElement;
          }
          return "body";
        }

        function shortSelector(el: Element): string {
          const parts: string[] = [];
          let cur: Element | null = el;
          let depth = 0;
          while (cur && depth < 4) {
            let p = cur.tagName.toLowerCase();
            if (cur.id) {
              parts.unshift(`${p}#${cur.id}`);
              break;
            }
            if (typeof cur.className === "string" && cur.className.trim()) {
              const cls = cur.className.trim().split(/\s+/).slice(0, 2).join(".");
              p += `.${cls}`;
            }
            parts.unshift(p);
            cur = cur.parentElement;
            depth++;
          }
          return parts.join(" > ");
        }

        function effectiveBg(el: Element): string {
          let cur: Element | null = el;
          while (cur) {
            const s = window.getComputedStyle(cur);
            if (
              s.backgroundColor &&
              s.backgroundColor !== "transparent" &&
              s.backgroundColor !== "rgba(0, 0, 0, 0)"
            ) {
              return s.backgroundColor;
            }
            if (s.backgroundImage && s.backgroundImage !== "none") {
              return "gradient-or-image";
            }
            cur = cur.parentElement;
          }
          return "rgb(255, 255, 255)";
        }

        function isVisible(el: Element): boolean {
          const s = window.getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0")
            return false;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return false;
          if (r.bottom < -100 || r.top > window.innerHeight + 3000) return false;
          return true;
        }

        // ---- Pass 1: text elements ----
        const results: any[] = [];
        const textEls = document.querySelectorAll(textSel);
        let tCount = 0;

        for (let i = 0; i < textEls.length && tCount < maxText; i++) {
          const el = textEls[i];
          if (!isVisible(el)) continue;
          if (!(el.textContent?.trim())) continue;

          const s = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();

          results.push({
            selector: shortSelector(el),
            tag: el.tagName.toLowerCase(),
            color: s.color,
            backgroundColor: effectiveBg(el),
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            lineHeight: s.lineHeight,
            fontFamily: s.fontFamily,
            letterSpacing: s.letterSpacing,
            marginTop: s.marginTop,
            marginRight: s.marginRight,
            marginBottom: s.marginBottom,
            marginLeft: s.marginLeft,
            paddingTop: s.paddingTop,
            paddingRight: s.paddingRight,
            paddingBottom: s.paddingBottom,
            paddingLeft: s.paddingLeft,
            gap: s.gap,
            borderRadius: s.borderRadius,
            boxShadow: s.boxShadow,
            borderWidth: s.borderWidth,
            borderStyle: s.borderStyle,
            borderColor: s.borderColor,
            zIndex: s.zIndex,
            opacity: s.opacity,
            transitionDuration: s.transitionDuration,
            transitionTimingFunction: s.transitionTimingFunction,
            isTextElement: true,
            region: getRegion(el),
            boundingBox: {
              width: r.width,
              height: r.height,
              top: r.top + window.scrollY,
              left: r.left + window.scrollX,
            },
          });
          tCount++;
        }

        // ---- Pass 2: layout elements (skip text ones we already have) ----
        const seen = new Set(results.map((r: any) => r.selector));

        /* Instead of querySelectorAll("*") which returns EVERY node,
           target elements that are likely to carry layout tokens.
           This cuts the scan from 10k+ nodes to a few hundred. */
        const layoutSel = "div, section, article, aside, main, header, footer, nav, ul, ol, form, fieldset, figure, details, dialog, table";
        const layoutEls = document.querySelectorAll(layoutSel);
        let lCount = 0;

        for (let i = 0; i < layoutEls.length && lCount < maxLayout; i++) {
          const el = layoutEls[i];
          if (!isVisible(el)) continue;
          const sel = shortSelector(el);
          if (seen.has(sel)) continue;

          const s = window.getComputedStyle(el);

          const interesting =
            s.borderRadius !== "0px" ||
            s.boxShadow !== "none" ||
            s.borderWidth !== "0px" ||
            (s.zIndex !== "auto" && s.zIndex !== "0") ||
            s.opacity !== "1" ||
            s.transitionDuration !== "0s" ||
            s.marginTop !== "0px" ||
            s.paddingTop !== "0px" ||
            (s.gap !== "normal" && s.gap !== "0px");

          if (!interesting) continue;

          const r = el.getBoundingClientRect();

          results.push({
            selector: sel,
            tag: el.tagName.toLowerCase(),
            marginTop: s.marginTop,
            marginRight: s.marginRight,
            marginBottom: s.marginBottom,
            marginLeft: s.marginLeft,
            paddingTop: s.paddingTop,
            paddingRight: s.paddingRight,
            paddingBottom: s.paddingBottom,
            paddingLeft: s.paddingLeft,
            gap: s.gap,
            borderRadius: s.borderRadius,
            boxShadow: s.boxShadow,
            borderWidth: s.borderWidth,
            borderStyle: s.borderStyle,
            borderColor: s.borderColor,
            zIndex: s.zIndex,
            opacity: s.opacity,
            transitionDuration: s.transitionDuration,
            transitionTimingFunction: s.transitionTimingFunction,
            isTextElement: false,
            region: getRegion(el),
            boundingBox: {
              width: r.width,
              height: r.height,
              top: r.top + window.scrollY,
              left: r.left + window.scrollX,
            },
          });
          lCount++;
        }

        return results;
      },
      {
        textSel: TEXT_SELECTORS,
        maxText: aggressiveMode ? MAX_TEXT_AGGRESSIVE : MAX_TEXT_DEFAULT,
        maxLayout: aggressiveMode ? MAX_LAYOUT_AGGRESSIVE : MAX_LAYOUT_DEFAULT,
      }
    );

    onProgress?.({
      phase: "sampled",
      message: `Sampled ${samples.length} elements`,
    });

    checkAbort();

    // ---- detect bot-protection / CAPTCHA pages ----
    if (samples.length < 10) {
      const title = await page.title();
      const botPatterns = [
        "just a moment",
        "captcha",
        "verify you are human",
        "access denied",
        "attention required",
        "checking your browser",
        "please wait",
        "ddos protection",
      ];
      const lower = title.toLowerCase();
      if (botPatterns.some((p) => lower.includes(p))) {
        throw new Error(
          `This site is protected by bot detection (page title: "${title}"). ` +
            "Headless browsers are blocked. Try a different site, or audit a " +
            "staging/preview URL that doesn't have anti-bot protection."
        );
      }
    }

    // ---- extract @font-face rules for type specimen rendering ----
    onProgress?.({ phase: "fonts", message: "Extracting font faces…" });
    const fontFaces: string[] = await page.evaluate(() => {
      const faces: string[] = [];
      try {
        for (const sheet of document.styleSheets) {
          try {
            const base = sheet.href || document.baseURI;
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSFontFaceRule) {
                let css = rule.cssText;
                css = css.replace(
                  /url\(['"]?([^'")]+)['"]?\)/g,
                  (_match: string, url: string) => {
                    try {
                      const abs = new URL(url, base).href;
                      return `url('${abs}')`;
                    } catch {
                      return _match;
                    }
                  }
                );
                faces.push(css);
              }
            }
          } catch {
            /* CORS-blocked stylesheet — skip */
          }
        }
      } catch {
        /* no stylesheets */
      }
      return faces;
    });

    checkAbort();

    // ---- extract CSS custom properties (design tokens) ----
    onProgress?.({ phase: "fonts", message: "Extracting design tokens…" });
    const tokenLimit = aggressiveMode ? 200 : 500;
    const cssTokens: CSSToken[] = await page.evaluate((maxTokens: number) => {
      const tokens: { name: string; value: string; rawValue?: string }[] = [];
      const seen = new Set<string>();
      const MAX_TOKENS = maxTokens;

      try {
        for (const sheet of document.styleSheets) {
          if (tokens.length >= MAX_TOKENS) break;
          try {
            for (const rule of sheet.cssRules) {
              if (tokens.length >= MAX_TOKENS) break;
              /* Only look at style rules (not @media, @keyframes, etc.) */
              if (!(rule instanceof CSSStyleRule)) continue;
              const style = rule.style;
              for (let i = 0; i < style.length; i++) {
                const prop = style[i];
                if (!prop.startsWith("--")) continue;
                if (seen.has(prop)) continue;
                seen.add(prop);

                const rawValue = style.getPropertyValue(prop).trim();
                /* Resolve the computed value from :root */
                const computed = getComputedStyle(document.documentElement)
                  .getPropertyValue(prop)
                  .trim();

                tokens.push({
                  name: prop,
                  value: computed || rawValue,
                  rawValue: rawValue !== computed ? rawValue : undefined,
                });
                if (tokens.length >= MAX_TOKENS) break;
              }
            }
          } catch {
            /* CORS-blocked stylesheet — skip */
          }
        }
      } catch {
        /* no stylesheets */
      }

      /* Sort alphabetically for consistent output */
      tokens.sort((a, b) => a.name.localeCompare(b.name));
      return tokens;
    }, tokenLimit);

    checkAbort();

    // ---- prepare for screenshot ----
    onProgress?.({ phase: "screenshot", message: "Taking screenshot…" });
    await page.evaluate(() => window.scrollTo(0, 0));
    /* Tiny settle — 150ms is enough for scroll to complete */
    await page.waitForTimeout(150);

    const pageHeight = await page.evaluate(() => document.body.scrollHeight);

    // ---- take screenshot (skip on serverless to save /tmp space) ----
    let screenshot: Buffer;
    if (isServerless) {
      screenshot = Buffer.alloc(0);
    } else {
      /* Cap screenshot height to avoid OOM on very tall pages */
      const clampedHeight = Math.min(pageHeight, MAX_SCREENSHOT_HEIGHT);
      const needsClip = pageHeight > MAX_SCREENSHOT_HEIGHT;

      if (needsClip) {
        screenshot = await page.screenshot({
          type: "jpeg",
          quality: 70,
          clip: { x: 0, y: 0, width: VIEWPORT_WIDTH, height: clampedHeight },
        });
      } else {
        screenshot = await page.screenshot({
          type: "jpeg",
          quality: 70,
          fullPage: true,
        });
      }
    }

    return {
      elements: samples,
      screenshot: Buffer.from(screenshot),
      viewportWidth: VIEWPORT_WIDTH,
      viewportHeight: VIEWPORT_HEIGHT,
      pageHeight,
      fontFaces: fontFaces.slice(0, 60),
      cssTokens,
    };
  } finally {
    if (browser) {
      /* Race browser.close() against a 5s timeout.
         A crashed browser can hang on close() indefinitely,
         and we need to free the memory before a potential retry. */
      await Promise.race([
        browser.close().catch(() => {}),
        new Promise((r) => setTimeout(r, 5_000)),
      ]);
    }
  }
}
