# Designlens

Paste a URL and get an instant visual-consistency audit: colour sprawl, typography sprawl, spacing sprawl, radius/shadow/border analysis, and more. Export proposed design tokens in seconds.

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
- **Shareable score card** — unique URL per audit, with OG meta tags
- **Export tokens** — `tokens.json` / Tailwind config / CSS custom properties
- **Prioritised fix plan** — ordered by impact and effort
- **Colour palette proposal** — neutrals, primary, accent extracted automatically
- **Type scale proposal** — based on most-used body font size
- **Spacing scale proposal** — detects base unit and proposes a systematic scale

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **Tailwind CSS 4**
- **Playwright** (server-side headless Chromium)

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

Open [http://localhost:3000](http://localhost:3000), paste a URL, click **Run Lint**.

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
- **Alpha compositing** — semi-transparent colours are collected as-is (not composited over the background for the colour analysis)
- **Rate limited** — 5 audits per minute per IP

## Project structure

```
src/
├── app/
│   ├── page.tsx                    # Main page
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Tailwind + custom styles
│   ├── api/
│   │   ├── audit/route.ts          # POST /api/audit (SSE)
│   │   └── report/[id]/route.ts    # GET /api/report/:id
│   └── report/[id]/
│       ├── page.tsx                # Shareable score card (server)
│       └── ReportCard.tsx          # Score card UI (client)
├── components/
│   ├── AuditPage.tsx               # Main interactive page
│   ├── ScoreRing.tsx               # SVG score ring
│   ├── SprawlSection.tsx           # Expandable sprawl section
│   ├── ColorPalette.tsx            # Colour sprawl display
│   ├── ExportPanel.tsx             # Token export tabs
│   └── FixPlanDisplay.tsx          # Fix plan list
└── lib/
    ├── validateUrl.ts              # URL validation + private IP blocking
    ├── store.ts                    # File-based report storage
    └── audit/
        ├── types.ts                # All TypeScript types
        ├── colorUtils.ts           # sRGB→LAB, Delta-E, colour naming
        ├── sampleDom.ts            # Playwright DOM sampling
        ├── sprawlColors.ts         # Colour sprawl analysis
        ├── sprawlType.ts           # Typography sprawl analysis
        ├── sprawlSpacing.ts        # Spacing sprawl analysis
        ├── sprawlMisc.ts           # Radius/shadow/z-index/opacity/transition
        ├── scoring.ts              # Per-category + overall scoring
        ├── fixPlan.ts              # Prioritised fix plan generator
        ├── exportTokens.ts         # tokens.json, Tailwind, CSS vars
        └── runAudit.ts             # Audit orchestrator
```
