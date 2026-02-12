# Designlens

Paste a URL and get an instant visual-consistency audit: colour sprawl, typography sprawl, spacing sprawl, radius/shadow/border analysis, and more.

## What it measures

| Category | What's checked | Ideal max |
|---|---|---|
| **Colours** | Unique hex values, near-duplicates (ΔE < 5), cluster count | 15 |
| **Font Sizes** | Distinct `font-size` values across text elements | 10 |
| **Font Weights** | Distinct `font-weight` values | 4 |
| **Font Families** | Distinct primary font families | 3 |
| **Line Heights** | Distinct `line-height` values | 6 |
| **Spacing** | Distinct margin / padding / gap values | 12 |
| **Border Radii** | Distinct `border-radius` values | 5 |
| **Box Shadows** | Distinct `box-shadow` values | 5 |
| **z-index** | Distinct `z-index` values | 5 |
| **Opacity** | Distinct `opacity` values | 5 |
| **Transitions** | Distinct `transition-duration` values | 4 |

Each category gets a 0–100 score. An overall **Design Consistency Score** is a weighted average.

## Features

- **SSE streaming progress** — see each phase happen in real-time
- **Shareable URL** — `/?url=example.com` auto-runs the audit for quick sharing
- **Prioritised fix plan** — findings ordered by impact and effort
- **Colour palette view** — hue groups, near-duplicates, click-to-copy hex values
- **Colour role detection** — background, text, interactive, border, accent inference
- **Type scale detection** — identifies if font sizes follow a known scale (e.g. 1.25 Major Third)
- **Text style palette** — all font-size / weight / family / line-height combinations in use
- **Spacing grid detection** — detects base unit, reports adherence %, flags off-grid values
- **Component pattern mining** — detects repeated style combinations that look like reusable components
- **CSS variable analysis** — categorises custom properties, detects duplicates, naming issues, orphans
- **Global search** — filter across all values, colours, and tokens with ⌘F
- **Fullscreen modal** — expand the results card to full viewport
- **Minimize / restore** — dock the card to a chip (macOS yellow-dot easter egg)
- **Dark / light theme** — persisted toggle with ambient particle effects
- **Page entrance animation** — GSAP-orchestrated waterfall reveal

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **Tailwind CSS 4**
- **Playwright** (server-side headless Chromium via `@sparticuz/chromium`)
- **GSAP** (SplitText, ScrollTrigger)

## Getting started

```bash
# Prerequisites: Node.js >= 20
nvm use 20  # or whatever you use

# Install deps
npm install

# Install Chromium for Playwright
npx playwright install chromium

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste a URL, click **Analyze**.

## How it works

1. Playwright loads the URL in headless Chromium (1280×900 viewport)
2. A `page.evaluate()` script samples up to 2000 text elements and 3000 layout elements
3. For each element, computed styles are collected via `getComputedStyle()`
4. Background colours are resolved by walking up the DOM tree
5. Analysis modules cluster, count, and propose scales
6. Results are streamed back via SSE

## Known limitations

- **Gradients / background images** — marked as "cannot reliably compute"
- **Pseudo-elements** — `::before` / `::after` backgrounds are not detected
- **Viewport-specific** — results are for 1280px desktop viewport only
- **JS-rendered content** — we wait for `networkidle` + 2s delay, but some SPAs may need longer
- **Font rendering** — `getComputedStyle` returns the *requested* font, not necessarily what actually rendered
- **Alpha compositing** — semi-transparent colours are collected as-is (not composited over the background)
- **Rate limited** — 5 audits per minute per IP

## Project structure

```
src/
├── app/
│   ├── page.tsx                    # Main page
│   ├── layout.tsx                  # Root layout
│   ├── not-found.tsx               # Custom 404
│   ├── globals.css                 # Tailwind + custom themes + keyframes
│   └── api/
│       └── audit/route.ts          # POST /api/audit (SSE)
├── components/
│   ├── AuditPage.tsx               # Main interactive page (input, progress, results)
│   ├── ScoreRing.tsx               # SVG score ring with grade
│   ├── SprawlSection.tsx           # Expandable sprawl section (values + bar chart)
│   ├── ColorPalette.tsx            # Colour sprawl display (hue groups, near-dupes)
│   ├── ColorRolesView.tsx          # Inferred colour roles (bg, text, interactive…)
│   ├── TypePaletteView.tsx         # Text style combinations with font preview
│   ├── TypeScaleView.tsx           # Detected type scale with outlier flags
│   ├── DesignTokensView.tsx        # CSS variable categories, insights, swatches
│   ├── PatternsView.tsx            # Component pattern mining display
│   ├── FixPlanDisplay.tsx          # Prioritised findings list
│   ├── ThemeToggle.tsx             # Light/dark toggle with confetti
│   ├── AmbientParticles.tsx        # Stars (dark) / dust motes (light)
│   ├── ScrollToTop.tsx             # FAB with scroll progress ring
│   └── TextReveal.tsx              # GSAP word/line reveal animation
└── lib/
    ├── validateUrl.ts              # URL validation + private IP blocking
    ├── sparkles.ts                 # Theme toggle confetti effect
    └── audit/
        ├── types.ts                # All TypeScript types
        ├── runAudit.ts             # Audit orchestrator
        ├── sampleDom.ts            # Playwright DOM sampling
        ├── analysis.ts             # Shared analysis primitives
        ├── colorUtils.ts           # sRGB→LAB, Delta-E, colour naming
        ├── sprawlColors.ts         # Colour sprawl analysis
        ├── sprawlType.ts           # Typography sprawl analysis
        ├── sprawlSpacing.ts        # Spacing sprawl analysis
        ├── sprawlMisc.ts           # Radius/shadow/z-index/opacity/transition
        ├── scoring.ts              # Per-category + overall scoring
        ├── fixPlan.ts              # Prioritised fix plan generator
        ├── typeScale.ts            # Type scale detection
        ├── colorRoles.ts           # Colour role inference
        ├── textStyles.ts           # Text style extraction
        ├── patterns.ts             # Component pattern mining
        ├── analyzeTokens.ts        # CSS variable categorisation + insights
        └── errorMessages.ts        # User-facing error messages
```
