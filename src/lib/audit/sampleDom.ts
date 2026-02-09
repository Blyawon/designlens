/* ---------------------------------------------------------------
   DOM sampling via Playwright
   Loads a page, collects computed styles from text elements and
   layout elements in a single page.evaluate pass.
   Also takes a screenshot for annotation overlay.
   --------------------------------------------------------------- */

import { chromium, Browser } from "playwright-core";
import { SampledElement, SampleResult, ProgressCallback } from "./types";

const TEXT_SELECTORS = [
  "p","span","a","li","button","input","label","th","td",
  "h1","h2","h3","h4","h5","h6","dt","dd","figcaption",
  "blockquote","code","pre","em","strong","b","i","small",
].join(",");

const MAX_TEXT = 2000;
const MAX_LAYOUT = 3000;

export async function sampleDom(
  url: string,
  onProgress?: ProgressCallback
): Promise<SampleResult> {
  let browser: Browser | null = null;

  try {
    onProgress?.({ phase: "launching", message: "Launching browser…" });

    const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isServerless) {
      const sparticuzChromium = (await import("@sparticuz/chromium")).default;
      browser = await chromium.launch({
        args: [
          ...sparticuzChromium.args,
          "--disable-gpu",
          "--disable-accelerated-2d-canvas",
          "--disable-canvas-aa",
          "--disable-background-networking",
          "--disk-cache-size=0",
        ],
        executablePath: await sparticuzChromium.executablePath(),
        headless: true,
      });
    } else {
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    const VIEWPORT_WIDTH = isServerless ? 1280 : 1280;
    const VIEWPORT_HEIGHT = isServerless ? 720 : 900;

    const page = await browser.newPage({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    page.setDefaultTimeout(isServerless ? 30_000 : 45_000);

    // Block heavy resources to save memory (especially on serverless).
    // On serverless: block images, media, fonts. We only need DOM + stylesheets.
    // Locally: keep fonts + images for screenshots / font specimens.
    const blockTypes = isServerless
      ? ["media", "image", "font"]
      : ["media"];

    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (blockTypes.includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    onProgress?.({ phase: "loading", message: `Loading ${url}…` });

    try {
      await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error && err.message.includes("Timeout");
      if (!isTimeout) throw err;
      onProgress?.({
        phase: "loading",
        message: "Page still loading resources — proceeding with what we have…",
      });
    }

    onProgress?.({ phase: "waiting", message: "Waiting for page to render…" });
    await page
      .waitForFunction(
        (sel: string) => document.querySelectorAll(sel).length > 10,
        TEXT_SELECTORS,
        { timeout: 10_000 }
      )
      .catch(() => {});

    // Try to dismiss cookie consent banners
    try {
      const consentHit = await page.evaluate(() => {
        const patterns = [
          'button[id*="accept" i]',
          'button[id*="consent" i]',
          'button[id*="agree" i]',
          'button[class*="accept" i]',
          'button[class*="consent" i]',
          'a[id*="accept" i]',
          '[class*="cookie"] button',
          '[class*="consent"] button',
          '[id*="cookie"] button',
          '[data-testid*="accept" i]',
          '[data-testid*="consent" i]',
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
      if (consentHit) {
        await page.waitForTimeout(2000);
      }
    } catch {
      /* consent dismissal is best-effort */
    }

    // Scroll the page to trigger lazy-rendered content, then return to top
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

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

        // ---- Pass 2: all visible elements for layout tokens ----
        const seen = new Set(results.map((r: any) => r.selector));
        const allEls = document.querySelectorAll("*");
        let lCount = 0;

        for (let i = 0; i < allEls.length && lCount < maxLayout; i++) {
          const el = allEls[i];
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
      { textSel: TEXT_SELECTORS, maxText: MAX_TEXT, maxLayout: MAX_LAYOUT }
    );

    onProgress?.({
      phase: "sampled",
      message: `Sampled ${samples.length} elements`,
    });

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
                // Resolve relative URLs to absolute so they work cross-origin
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

    // ---- prepare for screenshot ----
    onProgress?.({ phase: "screenshot", message: "Taking screenshot…" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    // Dismiss or force-hide any cookie/consent banners that may still
    // be visible. We try clicking first (broader patterns), then
    // fall back to hiding common overlay containers via CSS.
    try {
      await page.evaluate(() => {
        // Attempt 1: click any visible accept/dismiss button
        const btnPatterns = [
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
        for (const sel of btnPatterns) {
          const btn = document.querySelector<HTMLElement>(sel);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            return;
          }
        }

        // Attempt 2: force-hide common overlay containers
        const overlayPatterns = [
          '[class*="cookie" i]', '[class*="consent" i]',
          '[id*="cookie" i]', '[id*="consent" i]',
          '[class*="CookieBanner" i]', '[class*="cookie-banner" i]',
          '[class*="gdpr" i]', '[id*="gdpr" i]',
          '[class*="onetrust" i]', '[id*="onetrust" i]',
          '[class*="cc-banner" i]', '[class*="cc_banner" i]',
          '[id*="CybotCookiebot" i]',
          '[class*="sp_message" i]', // Sourcepoint
        ];
        for (const sel of overlayPatterns) {
          document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
            const rect = el.getBoundingClientRect();
            // Only hide if it looks like an overlay (wide + positioned at edges)
            const isOverlay =
              rect.width > window.innerWidth * 0.5 ||
              el.style.position === "fixed" ||
              window.getComputedStyle(el).position === "fixed" ||
              window.getComputedStyle(el).position === "sticky";
            if (isOverlay) {
              el.style.display = "none";
            }
          });
        }
      });
      await page.waitForTimeout(500);
    } catch {
      /* best-effort */
    }

    // ---- take full-page screenshot (skip on serverless to save /tmp space) ----
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    let screenshot: Buffer;
    if (isServerless) {
      screenshot = Buffer.alloc(0);
    } else {
      screenshot = await page.screenshot({
        type: "jpeg",
        quality: 75,
        fullPage: true,
      });
    }

    return {
      elements: samples,
      screenshot: Buffer.from(screenshot),
      viewportWidth: VIEWPORT_WIDTH,
      viewportHeight: VIEWPORT_HEIGHT,
      pageHeight,
      fontFaces: fontFaces.slice(0, 60), // Cap to avoid payload bloat
    };
  } finally {
    if (browser) await browser.close();
  }
}
