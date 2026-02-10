/* ---------------------------------------------------------------
   Design Token Analysis — CSS Custom Property Categorisation

   Takes raw CSS custom properties extracted from stylesheets and
   organises them into semantic categories using two heuristics:

   1. **Value inspection** — parse the resolved value to detect
      colours (hex, rgb, hsl, named), lengths (px, rem, em, %),
      font families, shadows, durations, z-indices, etc.

   2. **Name patterns** — variable names like "--color-primary",
      "--spacing-lg", "--font-size-xl" contain strong hints about
      intent.  Name patterns break ties when the value alone is
      ambiguous (e.g., "16px" could be a font-size or a spacing
      value, but "--font-size-base: 16px" is clearly typography).

   The result is a `DesignTokensResult` with groups sorted by
   a human-friendly category order, each group containing its
   tokens sorted alphabetically by name.
   --------------------------------------------------------------- */

import {
  CSSToken,
  DesignTokensResult,
  TokenCategory,
  TokenGroup,
  TokenInsights,
  TokenNearDuplicate,
  TokenNamingIssue,
  TokenShadowedValue,
  TokenOrphan,
  TokenScaleAnalysis,
  TokenDuplicate,
  TokenCategoryStats,
} from "./types";

/* ----------------------------------------------------------------
   Category display metadata
   ---------------------------------------------------------------- */

const CATEGORY_META: Record<TokenCategory, { label: string; order: number }> = {
  color:      { label: "Colors",             order: 0 },
  typography: { label: "Typography",         order: 1 },
  spacing:    { label: "Spacing",            order: 2 },
  sizing:     { label: "Sizing",             order: 3 },
  border:     { label: "Borders & Radii",    order: 4 },
  shadow:     { label: "Shadows",            order: 5 },
  opacity:    { label: "Opacity",            order: 6 },
  "z-index":  { label: "Z-Index & Layers",   order: 7 },
  transition: { label: "Transitions",        order: 8 },
  other:      { label: "Other",              order: 9 },
};

/* ----------------------------------------------------------------
   CSS named colours — a quick lookup to recognise bare colour names
   in values like "var(--x, red)" or "transparent", "inherit", etc.
   We only include the most common ones; the hex/rgb/hsl regex
   catches the vast majority.
   ---------------------------------------------------------------- */

const NAMED_COLORS = new Set([
  "transparent", "currentcolor",
  "black", "white", "red", "green", "blue", "yellow", "orange",
  "purple", "pink", "gray", "grey", "cyan", "magenta", "lime",
  "navy", "teal", "olive", "maroon", "aqua", "silver", "fuchsia",
  "coral", "crimson", "indigo", "ivory", "khaki", "lavender",
  "plum", "salmon", "sienna", "tan", "tomato", "turquoise",
  "violet", "wheat", "beige", "azure", "bisque", "chocolate",
  "gold", "honeydew", "linen", "mintcream", "mistyrose", "moccasin",
  "orchid", "peru", "seashell", "skyblue", "snow", "thistle",
]);

/* ----------------------------------------------------------------
   Value-based detection
   ---------------------------------------------------------------- */

/** Hex colour: #rgb, #rgba, #rrggbb, #rrggbbaa */
const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Functional colour notations */
const COLOR_FN_RE = /^(?:rgba?|hsla?|oklch|oklab|lch|lab|color|hwb)\s*\(/i;

/** CSS length units */
const LENGTH_RE = /^-?[\d.]+\s*(?:px|rem|em|vw|vh|vmin|vmax|ch|ex|cap|lh|rlh|dvw|dvh|svw|svh|cqw|cqh|%)$/i;

/** Durations */
const DURATION_RE = /^-?[\d.]+\s*(?:ms|s)$/i;

/** Numeric (plain number, e.g. for z-index, opacity, line-height) */
const NUMERIC_RE = /^-?[\d.]+$/;

/** Box-shadow / text-shadow pattern (heuristic: value contains 2+ lengths and a colour) */
const SHADOW_RE = /(?:[\d.]+(?:px|rem|em)\s*){2,}/i;

/** Font family heuristic — value contains a comma-separated list or known generic families */
const FONT_GENERIC_RE = /\b(?:sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace)\b/i;

function isColorValue(v: string): boolean {
  if (HEX_RE.test(v)) return true;
  if (COLOR_FN_RE.test(v)) return true;
  /* Named colour — only if it's a single word (not e.g. "none") */
  const lower = v.toLowerCase().trim();
  if (NAMED_COLORS.has(lower)) return true;
  return false;
}

function isShadowValue(v: string): boolean {
  /* Shadows typically have ≥2 length values + often a colour */
  return SHADOW_RE.test(v) && (isColorValue(v.split(/\s+/).pop() || "") || v.includes("rgb") || v.includes("#") || v.includes("hsl"));
}

function detectCategoryByValue(value: string): TokenCategory | null {
  const v = value.trim();
  if (!v || v === "none" || v === "inherit" || v === "initial" || v === "unset" || v === "revert") return null;

  if (isColorValue(v)) return "color";
  if (isShadowValue(v)) return "shadow";
  if (DURATION_RE.test(v)) return "transition";
  if (v.includes(",") && FONT_GENERIC_RE.test(v)) return "typography";
  if (FONT_GENERIC_RE.test(v)) return "typography";

  /* Pure number — could be z-index, opacity, or line-height.
     We'll disambiguate with name patterns later; default to "other" for now. */
  if (NUMERIC_RE.test(v)) {
    const n = parseFloat(v);
    if (n >= 0 && n <= 1) return "opacity";
    if (Number.isInteger(n) && Math.abs(n) >= 1 && Math.abs(n) <= 9999) return "z-index";
    return null; // ambiguous — defer to name
  }

  if (LENGTH_RE.test(v)) return null; // lengths need name context

  /* Multi-value shadows without a clear colour reference */
  if (SHADOW_RE.test(v)) return "shadow";

  return null;
}

/* ----------------------------------------------------------------
   Name-based detection — keyword patterns in the variable name
   ---------------------------------------------------------------- */

interface NameRule {
  pattern: RegExp;
  category: TokenCategory;
}

const NAME_RULES: NameRule[] = [
  /* Colours */
  { pattern: /(?:color|colour|clr|bg|background|text-color|fill|stroke|accent|brand|primary|secondary|tertiary|success|warning|error|danger|info|muted|foreground|surface)/i, category: "color" },
  /* Typography */
  { pattern: /(?:font|type|text|letter|line-height|leading|tracking|family|weight|italic)/i, category: "typography" },
  /* Spacing */
  { pattern: /(?:space|spacing|gap|margin|padding|inset|gutter)/i, category: "spacing" },
  /* Sizing */
  { pattern: /(?:size|width|height|max|min|container|breakpoint|screen)/i, category: "sizing" },
  /* Borders */
  { pattern: /(?:border|radius|rounded|outline|ring|divider)/i, category: "border" },
  /* Shadows */
  { pattern: /(?:shadow|elevation|drop)/i, category: "shadow" },
  /* Opacity */
  { pattern: /(?:opacity|alpha|transparency)/i, category: "opacity" },
  /* Z-index */
  { pattern: /(?:z-index|z-|layer|stack)/i, category: "z-index" },
  /* Transitions / animations */
  { pattern: /(?:transition|duration|delay|ease|easing|animation|motion)/i, category: "transition" },
];

function detectCategoryByName(name: string): TokenCategory | null {
  for (const rule of NAME_RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  return null;
}

/* ----------------------------------------------------------------
   Length subcategorisation — when a value is a length (e.g. "16px"),
   the name determines whether it's spacing, sizing, typography, or
   border.  Without a clear name signal, we default to "spacing"
   since that's the most common use of length tokens.
   ---------------------------------------------------------------- */

function categorizeLengthToken(name: string): TokenCategory {
  const byName = detectCategoryByName(name);
  if (byName) return byName;
  /* Fallback heuristic: if name contains "size" → sizing,
     otherwise most raw length tokens are spacing. */
  return "spacing";
}

/* ----------------------------------------------------------------
   Main categorisation
   ---------------------------------------------------------------- */

function categorizeToken(token: CSSToken): TokenCategory {
  /* 1. Name wins for strongly typed names */
  const byName = detectCategoryByName(token.name);

  /* 2. Value provides structural evidence */
  const byValue = detectCategoryByValue(token.value);

  /* 3. Resolution strategy:
        - If both agree, great.
        - Name takes priority for ambiguous values (lengths, numbers).
        - Value takes priority for unambiguous types (colours, shadows). */

  if (byName && byValue && byName === byValue) return byName;

  /* Unambiguous value types override name (e.g., a var named --border
     but whose value is clearly a colour → colour) */
  if (byValue === "color" || byValue === "shadow") return byValue;

  /* Name wins for everything else */
  if (byName) return byName;
  if (byValue) return byValue;

  /* Length without a clear name signal — subcategorise */
  if (LENGTH_RE.test(token.value.trim())) return categorizeLengthToken(token.name);

  return "other";
}

/* ================================================================
   ANALYSIS ENGINES
   ================================================================ */

/* ----------------------------------------------------------------
   1. Near-duplicate token values
   Compares tokens within the same category for values that are
   "suspiciously close" — for colors this uses a simple hex-distance,
   for lengths it's an absolute pixel difference.
   ---------------------------------------------------------------- */

function parseHexToRGB(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4)
    return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  if (h.length === 6 || h.length === 8)
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  return null;
}

/** Approximate perceptual color distance (redmean) */
function colorDistance(hex1: string, hex2: string): number | null {
  const a = parseHexToRGB(hex1), b = parseHexToRGB(hex2);
  if (!a || !b) return null;
  const rMean = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(
    (2 + rMean/256) * dr*dr + 4 * dg*dg + (2 + (255-rMean)/256) * db*db
  );
}

function parsePx(v: string): number | null {
  const m = v.trim().match(/^(-?[\d.]+)\s*px$/i);
  if (m) return parseFloat(m[1]);
  /* Convert rem to px (assume 16px base) for comparison */
  const r = v.trim().match(/^(-?[\d.]+)\s*rem$/i);
  if (r) return parseFloat(r[1]) * 16;
  return null;
}

function findNearDuplicates(buckets: Map<TokenCategory, CSSToken[]>): TokenNearDuplicate[] {
  const results: TokenNearDuplicate[] = [];

  for (const [cat, tokens] of buckets) {
    if (tokens.length < 2) continue;

    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const a = tokens[i], b = tokens[j];
        if (a.value === b.value) continue; // exact dupes aren't "near"

        if (cat === "color") {
          const aHex = HEX_RE.test(a.value) ? a.value : null;
          const bHex = HEX_RE.test(b.value) ? b.value : null;
          if (aHex && bHex) {
            const d = colorDistance(aHex, bHex);
            if (d !== null && d < 50 && d > 0) {
              results.push({
                token1: a.name, token2: b.name,
                value1: a.value, value2: b.value,
                category: cat,
                distance: `ΔE ≈ ${d.toFixed(1)}`,
              });
            }
          }
        } else if (cat === "spacing" || cat === "sizing" || cat === "border") {
          const aPx = parsePx(a.value), bPx = parsePx(b.value);
          if (aPx !== null && bPx !== null) {
            const diff = Math.abs(aPx - bPx);
            if (diff > 0 && diff <= 4) {
              results.push({
                token1: a.name, token2: b.name,
                value1: a.value, value2: b.value,
                category: cat,
                distance: `${diff}px`,
              });
            }
          }
        }
      }
    }
  }

  return results.slice(0, 50); // cap for sanity
}

/* ----------------------------------------------------------------
   2. Naming convention inconsistencies
   Detects the dominant prefix pattern per category and flags tokens
   that diverge.
   ---------------------------------------------------------------- */

const PREFIX_PATTERNS: Record<string, RegExp[]> = {
  color:      [/^--colou?r-/i, /^--clr-/i, /^--c-/i, /^--bg-/i, /^--text-/i, /^--fill-/i, /^--stroke-/i, /^--accent-/i, /^--brand-/i, /^--surface-/i],
  typography: [/^--font-/i, /^--type-/i, /^--text-/i, /^--fs-/i, /^--fw-/i, /^--lh-/i, /^--ff-/i, /^--leading-/i, /^--tracking-/i],
  spacing:    [/^--space-/i, /^--spacing-/i, /^--sp-/i, /^--gap-/i, /^--margin-/i, /^--padding-/i, /^--gutter-/i],
  sizing:     [/^--size-/i, /^--sz-/i, /^--width-/i, /^--height-/i, /^--w-/i, /^--h-/i],
  border:     [/^--border-/i, /^--radius-/i, /^--rounded-/i, /^--ring-/i],
  shadow:     [/^--shadow-/i, /^--elevation-/i, /^--drop-/i],
  opacity:    [/^--opacity-/i, /^--alpha-/i],
  "z-index":  [/^--z-/i, /^--layer-/i, /^--stack-/i],
  transition: [/^--transition-/i, /^--duration-/i, /^--ease-/i, /^--easing-/i, /^--animation-/i],
};

function findNamingIssues(buckets: Map<TokenCategory, CSSToken[]>): TokenNamingIssue[] {
  const issues: TokenNamingIssue[] = [];

  for (const [cat, tokens] of buckets) {
    if (tokens.length < 3) continue; // need enough to detect a pattern
    const patterns = PREFIX_PATTERNS[cat];
    if (!patterns || patterns.length === 0) continue;

    /* Count how many tokens match each prefix */
    const counts = patterns.map(p => ({
      pattern: p,
      matches: tokens.filter(t => p.test(t.name)).length,
    }));

    const dominant = counts.reduce((best, c) => c.matches > best.matches ? c : best, counts[0]);
    if (dominant.matches < 2) continue; // no clear convention

    /* Flag tokens that don't match the dominant prefix but DO match a different one */
    for (const token of tokens) {
      if (dominant.pattern.test(token.name)) continue;
      const matchesOther = counts.find(c => c !== dominant && c.pattern.test(token.name));
      if (matchesOther) {
        issues.push({
          token: token.name,
          expected: dominant.pattern.source.replace(/^\^/, "").replace(/\\/g, "").replace(/\/i$/, "").replace(/-$/,""),
          actual: matchesOther.pattern.source.replace(/^\^/, "").replace(/\\/g, "").replace(/\/i$/, "").replace(/-$/,""),
          category: cat,
        });
      }
    }
  }

  return issues.slice(0, 30);
}

/* ----------------------------------------------------------------
   3. Hardcoded values that shadow tokens
   Cross-references resolved token values against the values found
   in the style sprawl. If a token resolves to a hex color and that
   same hex appears as a hardcoded value in the sprawl, it means
   someone is using the raw value instead of var(--token).
   ---------------------------------------------------------------- */

export interface HardcodedValueMap {
  colors: Map<string, number>;    // hex → count
  values: Map<string, number>;    // any value string → count
}

function findShadowedValues(
  buckets: Map<TokenCategory, CSSToken[]>,
  hardcoded: HardcodedValueMap | null
): TokenShadowedValue[] {
  if (!hardcoded) return [];
  const results: TokenShadowedValue[] = [];

  for (const [cat, tokens] of buckets) {
    for (const token of tokens) {
      const v = token.value.trim().toLowerCase();
      if (!v) continue;

      let count = 0;
      if (cat === "color" && HEX_RE.test(v)) {
        count = hardcoded.colors.get(v) || 0;
      } else {
        count = hardcoded.values.get(v) || 0;
      }

      if (count > 0) {
        results.push({
          token: token.name,
          resolvedValue: token.value,
          hardcodedCount: count,
          category: cat,
        });
      }
    }
  }

  /* Sort by most-shadowed first */
  results.sort((a, b) => b.hardcodedCount - a.hardcodedCount);
  return results.slice(0, 40);
}

/* ----------------------------------------------------------------
   4. Orphaned / broken token references
   When rawValue references a var() but the resolved value is empty,
   initial, inherit, or the same as the raw reference — the chain
   is broken.
   ---------------------------------------------------------------- */

const BROKEN_VALUES = new Set(["", "initial", "inherit", "unset", "revert", "revert-layer"]);
const VAR_REF_RE = /var\(\s*(--[\w-]+)/;

function findOrphans(tokens: CSSToken[]): TokenOrphan[] {
  const orphans: TokenOrphan[] = [];
  const knownNames = new Set(tokens.map(t => t.name));

  for (const token of tokens) {
    const raw = token.rawValue || "";
    const resolved = token.value.trim();

    /* Case 1: Value resolved to nothing / CSS default keywords */
    if (BROKEN_VALUES.has(resolved.toLowerCase()) && raw) {
      const refMatch = VAR_REF_RE.exec(raw);
      orphans.push({
        token: token.name,
        rawValue: raw,
        resolvedValue: resolved || "(empty)",
        reason: refMatch
          ? `References ${refMatch[1]} which doesn't resolve`
          : "Resolves to an empty or inherited value",
      });
      continue;
    }

    /* Case 2: Raw references a var that doesn't exist in our token set */
    if (raw) {
      const refMatch = VAR_REF_RE.exec(raw);
      if (refMatch) {
        const refName = refMatch[1];
        if (!knownNames.has(refName) && BROKEN_VALUES.has(resolved.toLowerCase())) {
          orphans.push({
            token: token.name,
            rawValue: raw,
            resolvedValue: resolved || "(empty)",
            reason: `References ${refName} which is not defined in any stylesheet`,
          });
        }
      }
    }
  }

  return orphans;
}

/* ----------------------------------------------------------------
   5. Scale / system detection
   For spacing and sizing tokens, detect if values follow a
   consistent base grid. For typography, detect modular scale ratio.
   ---------------------------------------------------------------- */

function analyzeScales(buckets: Map<TokenCategory, CSSToken[]>): TokenScaleAnalysis[] {
  const scales: TokenScaleAnalysis[] = [];

  /* --- Spacing / Sizing: detect base grid --- */
  for (const cat of ["spacing", "sizing"] as TokenCategory[]) {
    const tokens = buckets.get(cat);
    if (!tokens || tokens.length < 3) continue;

    const pxValues = tokens
      .map(t => ({ name: t.name, px: parsePx(t.value) }))
      .filter((v): v is { name: string; px: number } => v.px !== null && v.px > 0);

    if (pxValues.length < 3) continue;

    /* Try common bases: 2, 4, 8 */
    let bestBase = 4;
    let bestAdherence = 0;

    for (const base of [2, 4, 8]) {
      const on = pxValues.filter(v => v.px % base === 0);
      const adherence = Math.round((on.length / pxValues.length) * 100);
      if (adherence > bestAdherence) {
        bestBase = base;
        bestAdherence = adherence;
      }
    }

    const onScale = pxValues.filter(v => v.px % bestBase === 0).map(v => v.name);
    const offScale = pxValues.filter(v => v.px % bestBase !== 0).map(v => v.name);

    scales.push({
      category: cat,
      label: CATEGORY_META[cat].label,
      detectedBase: bestBase,
      adherence: bestAdherence,
      onScale,
      offScale,
    });
  }

  /* --- Typography: detect modular scale ratio --- */
  const typoTokens = buckets.get("typography");
  if (typoTokens && typoTokens.length >= 3) {
    const pxSizes = typoTokens
      .map(t => ({ name: t.name, px: parsePx(t.value) }))
      .filter((v): v is { name: string; px: number } => v.px !== null && v.px > 0)
      .sort((a, b) => a.px - b.px);

    if (pxSizes.length >= 3) {
      /* Compute ratios between consecutive sizes */
      const ratios: number[] = [];
      for (let i = 1; i < pxSizes.length; i++) {
        if (pxSizes[i - 1].px > 0) {
          ratios.push(pxSizes[i].px / pxSizes[i - 1].px);
        }
      }

      if (ratios.length >= 2) {
        const avgRatio = ratios.reduce((s, r) => s + r, 0) / ratios.length;
        /* Check how many ratios are close to the average */
        const TOLERANCE = 0.15;
        const onScale = [pxSizes[0].name];
        const offScale: string[] = [];
        for (let i = 1; i < pxSizes.length; i++) {
          const r = pxSizes[i].px / pxSizes[i - 1].px;
          if (Math.abs(r - avgRatio) / avgRatio <= TOLERANCE) {
            onScale.push(pxSizes[i].name);
          } else {
            offScale.push(pxSizes[i].name);
          }
        }

        const adherence = Math.round((onScale.length / pxSizes.length) * 100);
        if (avgRatio > 1.05 && avgRatio < 2.0) {
          scales.push({
            category: "typography",
            label: "Typography",
            detectedRatio: Math.round(avgRatio * 100) / 100,
            adherence,
            onScale,
            offScale,
          });
        }
      }
    }
  }

  return scales;
}

/* ----------------------------------------------------------------
   6. Exact duplicates — tokens sharing identical computed values
   Always fires when ≥2 tokens resolve to the same string.
   ---------------------------------------------------------------- */

function findExactDuplicates(buckets: Map<TokenCategory, CSSToken[]>): TokenDuplicate[] {
  const dupes: TokenDuplicate[] = [];

  for (const [cat, tokens] of buckets) {
    const byValue = new Map<string, string[]>();
    for (const t of tokens) {
      const v = t.value.trim();
      if (!v) continue;
      const list = byValue.get(v) || [];
      list.push(t.name);
      byValue.set(v, list);
    }
    for (const [value, names] of byValue) {
      if (names.length >= 2) {
        dupes.push({ value, tokens: names, category: cat });
      }
    }
  }

  /* Sort by group size descending, then alphabetically */
  dupes.sort((a, b) => b.tokens.length - a.tokens.length || a.value.localeCompare(b.value));
  return dupes.slice(0, 40);
}

/* ----------------------------------------------------------------
   7. Per-category stats — breakdown with unique counts and ranges
   Always fires for every populated category.
   ---------------------------------------------------------------- */

function buildCategoryStats(buckets: Map<TokenCategory, CSSToken[]>): TokenCategoryStats[] {
  const stats: TokenCategoryStats[] = [];

  for (const [cat, tokens] of buckets) {
    const uniqueValues = new Set(tokens.map(t => t.value.trim())).size;
    const aliasedCount = tokens.filter(t => t.rawValue && /var\(/.test(t.rawValue)).length;

    /* Numeric range for applicable categories */
    let min: string | undefined;
    let max: string | undefined;
    if (["spacing", "sizing", "border", "typography"].includes(cat)) {
      const pxVals = tokens
        .map(t => ({ name: t.name, px: parsePx(t.value), raw: t.value }))
        .filter((v): v is { name: string; px: number; raw: string } => v.px !== null);
      if (pxVals.length > 0) {
        pxVals.sort((a, b) => a.px - b.px);
        min = pxVals[0].raw;
        max = pxVals[pxVals.length - 1].raw;
      }
    }

    stats.push({
      category: cat,
      label: CATEGORY_META[cat].label,
      count: tokens.length,
      uniqueValues,
      aliasedCount,
      min,
      max,
    });
  }

  stats.sort((a, b) => CATEGORY_META[a.category].order - CATEGORY_META[b.category].order);
  return stats;
}

/* ----------------------------------------------------------------
   8. Aliasing rate — what % of tokens reference other tokens
   ---------------------------------------------------------------- */

function computeAliasingRate(tokens: CSSToken[]): number {
  if (tokens.length === 0) return 0;
  const aliased = tokens.filter(t => t.rawValue && /var\(/.test(t.rawValue)).length;
  return Math.round((aliased / tokens.length) * 100);
}

/* ----------------------------------------------------------------
   Aggregate all insights
   ---------------------------------------------------------------- */

function computeInsights(
  tokens: CSSToken[],
  buckets: Map<TokenCategory, CSSToken[]>,
  hardcoded: HardcodedValueMap | null
): TokenInsights {
  return {
    /* Always-visible */
    categoryStats: buildCategoryStats(buckets),
    duplicates: findExactDuplicates(buckets),
    aliasingRate: computeAliasingRate(tokens),

    /* Conditional */
    nearDuplicates: findNearDuplicates(buckets),
    namingIssues: findNamingIssues(buckets),
    shadowedValues: findShadowedValues(buckets, hardcoded),
    orphans: findOrphans(tokens),
    scales: analyzeScales(buckets),
  };
}

/* ================================================================
   Public API
   ================================================================ */

export function analyzeTokens(
  tokens: CSSToken[],
  hardcoded?: HardcodedValueMap | null
): DesignTokensResult {
  const emptyInsights: TokenInsights = {
    categoryStats: [], duplicates: [], aliasingRate: 0,
    nearDuplicates: [], namingIssues: [], shadowedValues: [],
    orphans: [], scales: [],
  };

  if (tokens.length === 0) {
    return { totalCount: 0, groups: [], insights: emptyInsights };
  }

  /* Bucket tokens by category */
  const buckets = new Map<TokenCategory, CSSToken[]>();

  for (const token of tokens) {
    const cat = categorizeToken(token);
    let list = buckets.get(cat);
    if (!list) {
      list = [];
      buckets.set(cat, list);
    }
    list.push(token);
  }

  /* Build ordered groups, skipping empty categories */
  const groups: TokenGroup[] = [];
  for (const [cat, items] of buckets) {
    const meta = CATEGORY_META[cat];
    groups.push({
      category: cat,
      label: meta.label,
      tokens: items.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  /* Sort groups by display order */
  groups.sort(
    (a, b) =>
      CATEGORY_META[a.category].order - CATEGORY_META[b.category].order
  );

  /* Run all five analyses */
  const insights = computeInsights(tokens, buckets, hardcoded || null);

  return {
    totalCount: tokens.length,
    groups,
    insights,
  };
}
