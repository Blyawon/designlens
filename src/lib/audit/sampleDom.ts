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
import { rmSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

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

function isCrashError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Target page, context or browser has been closed") ||
    msg.includes("Target closed") ||
    msg.includes("Browser has been closed") ||
    msg.includes("Protocol error") ||
    msg.includes("crashed")
  );
}

/* Max time budget for the entire sampleDom call (including retries).
   Must be less than the serverless function maxDuration (120s) to leave
   time for the analysis phase after DOM sampling. */
const SAMPLE_BUDGET_MS = 90_000;

export async function sampleDom(
  url: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<SampleResult> {
  /* Retry strategy for non-deterministic crashes:
     1. Normal attempt — full JS, full viewport, all resources
     2. If crash → plain retry (same settings, fresh browser process —
        catches intermittent OOM caused by GC timing or JIT variance)
     3. If crash again → aggressive mode (no JS, blocked scripts,
        smaller viewport — the nuclear option for truly heavy pages)
     Each retry only fires if we have enough time budget left. */
  const startedAt = Date.now();
  const hasTime = () => Date.now() - startedAt < SAMPLE_BUDGET_MS;

  // Attempt 1: normal
  try {
    return await sampleDomOnce(url, onProgress, signal, false);
  } catch (err) {
    if (!isCrashError(err) || signal?.aborted || !hasTime()) throw err;
    const mem = process.memoryUsage();
    console.log("[audit] Attempt 1 crashed:", {
      err: err instanceof Error ? err.message : String(err),
      heapMB: Math.round(mem.heapUsed / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    });
  }

  // Attempt 2: plain retry — same settings, fresh browser
  onProgress?.({ phase: "retrying", message: "Browser crashed — retrying…" });
  try {
    return await sampleDomOnce(url, onProgress, signal, false);
  } catch (err) {
    if (!isCrashError(err) || signal?.aborted || !hasTime()) throw err;
    const mem = process.memoryUsage();
    console.log("[audit] Attempt 2 crashed:", {
      err: err instanceof Error ? err.message : String(err),
      heapMB: Math.round(mem.heapUsed / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    });
  }

  // Attempt 3: aggressive — no JS, smaller viewport, blocked scripts
  onProgress?.({ phase: "retrying", message: "Crashed again — retrying without JavaScript…" });
  return await sampleDomOnce(url, onProgress, signal, true);
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
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  /* ── Safe-list: files in /tmp that belong to @sparticuz/chromium ──
     executablePath() checks `existsSync("/tmp/chromium")` and skips
     extraction on warm containers. If we delete ANY of these, the
     next invocation silently has a broken Chrome (no fonts, missing
     libs, etc.) and crashes. Everything ELSE in /tmp is ephemeral
     per-invocation junk (Playwright profiles, disk cache, crash
     dumps) and must be cleaned up. */
  const SPARTICUZ_KEEP = new Set([
    "chromium",                    // the binary
    "fonts",                       // font files directory
    "al2023",                      // Amazon Linux 2023 compat libs
    "swiftshader",                 // SwiftShader dir (may exist from older deploys)
    "libGLESv2.so",                // SwiftShader lib
    "libEGL.so",                   // SwiftShader lib
    "libvk_swiftshader.so",        // Vulkan SwiftShader
    "vk_swiftshader_icd.json",     // Vulkan config
  ]);

  /** Delete everything in /tmp that isn't sparticuz's. */
  function sweepTmp() {
    if (!isServerless) return;
    try {
      const tmp = tmpdir();
      for (const name of readdirSync(tmp)) {
        if (SPARTICUZ_KEEP.has(name)) continue;
        try { rmSync(join(tmp, name), { recursive: true, force: true }); }
        catch { /* best effort */ }
      }
    } catch { /* /tmp read failed — not fatal */ }
  }

  try {
    onProgress?.({ phase: "launching", message: "Launching browser…" });

    /* ── Diagnostics (shows up in Vercel function logs) ── */
    if (isServerless) {
      const mem = process.memoryUsage();
      const tmpContents = (() => { try { return readdirSync(tmpdir()); } catch { return []; } })();
      console.log("[audit] pre-launch diagnostics:", JSON.stringify({
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        externalMB: Math.round(mem.external / 1024 / 1024),
        tmpFiles: tmpContents.length,
        tmpNames: tmpContents.slice(0, 30),
        aggressiveMode,
      }));
    }

    /* ── Pre-launch /tmp sweep ── */
    sweepTmp();

    /* ── Chrome launch args ──
       CRITICAL: @sparticuz/chromium passes --headless='shell' with literal
       single quotes. When Playwright spawns Chrome (no shell involved),
       Chrome receives the quotes as part of the value and doesn't
       recognise 'shell' as a valid headless mode. Meanwhile Playwright
       adds --headless=new (from headless:true). The last flag wins, but
       sparticuz's broken flag might confuse the parser. The result:
       Chrome falls back to "new" headless — the HEAVY mode that spins up
       a full browser UI layer (~200-400MB more RAM).

       Fix: strip ALL --headless flags from sparticuz's args. Add our own
       --headless=shell (no quotes) LAST so it overrides Playwright's
       --headless=new. Shell mode is the lightweight old headless — same
       CDP/screenshot support, 200-400MB less RAM. On a 3008MB container,
       that's the difference between Chrome fitting and Chrome OOMing
       on warm containers where Node.js has already consumed 500MB+. */

    const extraArgs = [
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-extensions",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--disable-component-update",
      "--disable-ipc-flooding-protection",
      "--disable-speech-api",
      "--metrics-recording-only",
      "--mute-audio",
      "--hide-scrollbars",
      "--disable-webgl",
      "--disable-webgl2",
      "--disable-accelerated-2d-canvas",
      "--disable-canvas-aa",
      "--js-flags=--max-old-space-size=512",
      "--disk-cache-size=0",
      "--disable-breakpad",
      "--disable-crash-reporter",
      /* MUST be last — overrides Playwright's --headless=new */
      "--headless=shell",
    ];

    /* Flags to strip from sparticuz defaults */
    const stripFlags = new Set([
      /* SwiftShader GPU emulation — we don't render pixels */
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--in-process-gpu",
    ]);

    if (isServerless) {
      const sparticuzChromium = (await import("@sparticuz/chromium")).default;
      sparticuzChromium.setGraphicsMode = false;

      /* Filter sparticuz defaults:
         - remove SwiftShader flags
         - remove broken --headless='shell' (literal quotes)
         - remove --disk-cache-size=32MB (we set 0) */
      const baseArgs = sparticuzChromium.args.filter(
        (a: string) =>
          !stripFlags.has(a) &&
          !a.startsWith("--disk-cache-size") &&
          !a.startsWith("--headless")
      );

      const finalArgs = [...baseArgs, "--disable-gpu", ...extraArgs];
      console.log("[audit] Chrome args headless flags:",
        finalArgs.filter(a => a.startsWith("--headless")));
      browser = await chromium.launch({
        args: finalArgs,
        executablePath: await sparticuzChromium.executablePath(),
        headless: true,
      });
      console.log("[audit] Chrome launched successfully");
    } else {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-gpu",
          ...extraArgs,
        ],
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
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: aggressiveMode ? 15_000 : 20_000 });
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
          if (!btn) continue;
          /* offsetParent is null for position:fixed elements — which is
             how most cookie banners are positioned. Use getComputedStyle
             and getBoundingClientRect as a reliable visibility check. */
          const cs = window.getComputedStyle(btn);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const rect = btn.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          btn.click();
          return true;
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
    if (!aggressiveMode) {
      const scrollTarget = await page.evaluate(
        (maxDepth: number) => Math.min(document.body.scrollHeight, maxDepth),
        MAX_SCROLL_DEPTH
      );
      await page.evaluate((target: number) => window.scrollTo(0, target), scrollTarget);
      /* Wait until new DOM content appears (lazy-load) or 1s max */
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
    }

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
          /* Fall back to the root element's background — correct for dark-mode sites
             instead of blindly assuming white. */
          const rootBg = window.getComputedStyle(document.documentElement).backgroundColor;
          if (rootBg && rootBg !== "transparent" && rootBg !== "rgba(0, 0, 0, 0)") {
            return rootBg;
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
        /* Build a set of actual DOM nodes we already sampled as text elements,
           so we skip them by identity instead of by selector string (which can
           collide for different elements with similar class names). */
        const textNodeSet = new Set<Element>();
        const textEls2 = document.querySelectorAll(textSel);
        for (let i = 0; i < textEls2.length && textNodeSet.size < tCount; i++) {
          if (isVisible(textEls2[i]) && textEls2[i].textContent?.trim()) {
            textNodeSet.add(textEls2[i]);
          }
        }

        /* Instead of querySelectorAll("*") which returns EVERY node,
           target elements that are likely to carry layout tokens.
           This cuts the scan from 10k+ nodes to a few hundred. */
        const layoutSel = "div, section, article, aside, main, header, footer, nav, ul, ol, form, fieldset, figure, details, dialog, table";
        const layoutEls = document.querySelectorAll(layoutSel);
        let lCount = 0;

        for (let i = 0; i < layoutEls.length && lCount < maxLayout; i++) {
          const el = layoutEls[i];
          if (!isVisible(el)) continue;
          if (textNodeSet.has(el)) continue;

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
            selector: shortSelector(el),
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
      screenshot,
      viewportWidth: VIEWPORT_WIDTH,
      viewportHeight: VIEWPORT_HEIGHT,
      pageHeight,
      fontFaces: fontFaces.slice(0, 60),
      cssTokens,
    };
  } finally {
    /* ── Cleanup strategy ──
       1. Try browser.close() with a generous 10s timeout.
          This lets Playwright clean up IPC, sockets, and its own temp dirs.
       2. If close hangs → SIGKILL the Chrome process.
       3. sweepTmp() deletes everything in /tmp except sparticuz's files.
          This catches leaked user data dirs, crash dumps, xdg dirs, etc.
          regardless of naming patterns or Playwright versions. */

    if (browser) {
      let closedCleanly = false;
      try {
        const closePromise = browser.close().then(() => { closedCleanly = true; }).catch(() => {});
        await Promise.race([
          closePromise,
          new Promise((resolve) => setTimeout(resolve, 10_000)),
        ]);
      } catch {
        /* close() threw — Chrome probably already crashed */
      }

      if (!closedCleanly) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const proc = (browser as any).process?.();
          if (proc?.pid) {
            if (isServerless) {
              try { process.kill(proc.pid, "SIGKILL"); } catch { /* already dead */ }
            } else {
              try { process.kill(-proc.pid, "SIGKILL"); } catch { /* not a group leader */ }
              try { process.kill(proc.pid, "SIGKILL"); } catch { /* already dead */ }
            }
          }
        } catch { /* already dead */ }
      }
    }

    /* Post-invocation sweep — clean up EVERYTHING this browser left
       behind. Same safe-list approach as pre-launch. */
    sweepTmp();
  }
}
