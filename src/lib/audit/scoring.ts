/* ---------------------------------------------------------------
   Scoring — signal-based per-category
   --------------------------------------------------------------- */

import {
  AuditScores,
  CategoryScore,
  ScoreSignal,
  ColorSprawlResult,
  TypeSprawlResult,
  SpacingSprawlResult,
  MiscSprawlResult,
} from "./types";

type Grade = "A" | "B" | "C" | "D" | "F";

function grade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "F";
}

function economy(count: number, ideal: number, tolerance: number): number {
  if (count <= ideal) return 100;
  return Math.max(0, Math.round(100 * Math.exp(-(count - ideal) / tolerance)));
}

function pctClean(
  values: { value: string }[],
  pred: (px: number) => boolean
): number {
  const nums = values
    .map((v) => parseFloat(v.value) || 0)
    .filter((px) => px > 0);
  if (nums.length === 0) return 100;
  return Math.round((nums.filter(pred).length / nums.length) * 100);
}

function cat(
  name: string,
  signals: ScoreSignal[],
  weights?: number[]
): CategoryScore {
  if (signals.length === 0) return { name, score: 100, grade: "A", signals };
  const w = weights ?? signals.map(() => 1);
  let wSum = 0,
    wTotal = 0;
  for (let i = 0; i < signals.length; i++) {
    wSum += signals[i].value * (w[i] ?? 1);
    wTotal += w[i] ?? 1;
  }
  const score = Math.round(wSum / wTotal);
  return { name, score, grade: grade(score), signals };
}

/* ---- per-category ---- */

function scoreColors(c: ColorSprawlResult): CategoryScore {
  const dupPenalty =
    c.allColors.length > 0
      ? Math.max(
          0,
          Math.round(
            (1 -
              c.nearDuplicates.length /
                Math.max(c.allColors.length, 1)) *
              100
          )
        )
      : 100;
  const hueCount = c.hueGroups?.length ?? 0;
  const coherence =
    hueCount <= 3 ? 100 : hueCount <= 5 ? 75 : hueCount <= 7 ? 50 : 25;
  return cat(
    "Colors",
    [
      {
        name: "Redundancy",
        value: dupPenalty,
        label:
          c.nearDuplicates.length === 0
            ? "No near-duplicates"
            : `${c.nearDuplicates.length} near-duplicate pairs`,
      },
      {
        name: "Coherence",
        value: coherence,
        label: `${hueCount} hue families`,
      },
      {
        name: "Economy",
        value: economy(c.uniqueCount, 15, 12),
        label: `${c.uniqueCount} unique colours`,
      },
    ],
    [3, 2, 2]
  );
}

function scoreFontSizes(t: TypeSprawlResult): CategoryScore {
  const clean = pctClean(t.fontSizes, (px) =>
    Math.abs(px - Math.round(px)) < 0.1
  );
  const dupes = t.sizeNearDuplicates.length;
  return cat(
    "Font Sizes",
    [
      {
        name: "Cleanliness",
        value: clean,
        label: clean === 100 ? "All whole pixels" : `${clean}% whole pixels`,
      },
      {
        name: "Near-dupes",
        value: dupes === 0 ? 100 : Math.max(0, 100 - dupes * 25),
        label:
          dupes === 0
            ? "None"
            : `${dupes} pair${dupes > 1 ? "s" : ""}`,
      },
      {
        name: "Economy",
        value: economy(t.fontSizes.length, 8, 5),
        label: `${t.fontSizes.length} sizes`,
      },
    ],
    [2, 3, 2]
  );
}

function scoreFontWeights(t: TypeSprawlResult): CategoryScore {
  const std = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900]);
  const discipline = pctClean(t.fontWeights, (px) => std.has(px));
  return cat(
    "Font Weights",
    [
      {
        name: "Discipline",
        value: discipline,
        label:
          discipline === 100
            ? "All standard"
            : `${discipline}% standard`,
      },
      {
        name: "Economy",
        value: economy(t.fontWeights.length, 4, 2),
        label: `${t.fontWeights.length} weights`,
      },
    ],
    [3, 2]
  );
}

function scoreLineHeights(t: TypeSprawlResult): CategoryScore {
  // Score based on RATIOS (lineHeight/fontSize), not raw pixel counts.
  // A site using `line-height: 1.5` everywhere will have many pixel values
  // but only 1 ratio — that's excellent, not sprawl.
  const ratioCount = t.lineHeightRatios.length;
  return cat("Line Heights", [
    {
      name: "Ratio consistency",
      value: economy(ratioCount, 4, 4),
      label:
        ratioCount <= 4
          ? `${ratioCount} ratio${ratioCount !== 1 ? "s" : ""} — tight`
          : `${ratioCount} distinct ratios`,
    },
  ]);
}

function scoreFontFamilies(t: TypeSprawlResult): CategoryScore {
  const n = t.fontFamilies.length;
  const score = n <= 2 ? 100 : n === 3 ? 75 : n === 4 ? 50 : 20;
  return cat("Font Families", [
    {
      name: "Economy",
      value: score,
      label: n <= 2 ? `${n} — tight` : `${n} families`,
    },
  ]);
}

function scoreSpacing(s: SpacingSprawlResult): CategoryScore {
  const dupes = s.nearDuplicates.length;
  return cat(
    "Spacing",
    [
      {
        name: "Grid adherence",
        value: s.adherence,
        label: `${s.adherence}% on ${s.detectedBase}px grid`,
      },
      {
        name: "Near-dupes",
        value: dupes === 0 ? 100 : Math.max(0, 100 - dupes * 15),
        label: dupes === 0 ? "None" : `${dupes} pairs`,
      },
      {
        name: "Economy",
        value: economy(s.allValues.length, 12, 8),
        label: `${s.allValues.length} values`,
      },
    ],
    [4, 2, 2]
  );
}

function scoreBorderRadii(m: MiscSprawlResult): CategoryScore {
  // Score on cleanliness, NOT on count.
  // A design system can legitimately have 8+ radii (sm, md, lg, xl, 2xl, full, etc.)
  const clean = pctClean(m.borderRadii, (px) => {
    if (px >= 999) return true; // full round (9999px)
    const r = px % 2;
    return r < 0.1 || 2 - r < 0.1; // even values
  });
  // Also accept percentage values like "50%" — parseFloat gives 50, which is even
  return cat("Border Radii", [
    {
      name: "Consistency",
      value: clean,
      label:
        clean === 100
          ? "All clean values"
          : `${clean}% are clean values`,
    },
  ]);
}

function scoreBoxShadows(m: MiscSprawlResult): CategoryScore {
  return cat("Box Shadows", [
    {
      name: "Economy",
      value: economy(m.boxShadows.length, 5, 4),
      label: `${m.boxShadows.length} shadows`,
    },
  ]);
}

function scoreZIndex(m: MiscSprawlResult): CategoryScore {
  // Score on intentionality, not count.
  // 8 z-index values is fine if they look like a named scale.
  const intentional = new Set([
    -1, 0, 1, 2, 10, 20, 30, 40, 50, 100, 200, 500, 999, 1000, 9999, 99999,
  ]);
  const vals = m.zIndices.map((z) => parseInt(z.value) || 0);
  const pctIntentional =
    vals.length === 0
      ? 100
      : Math.round(
          (vals.filter((v) => intentional.has(v) || v % 10 === 0).length /
            vals.length) *
            100
        );
  return cat("z-index", [
    {
      name: "Intentionality",
      value: pctIntentional,
      label:
        pctIntentional === 100
          ? "All values look intentional"
          : `${pctIntentional}% look intentional`,
    },
  ]);
}

/* ---- overall ---- */

const WEIGHTS: Record<string, number> = {
  Colors: 3,
  "Font Sizes": 2.5,
  "Font Weights": 1.5,
  "Line Heights": 1,
  "Font Families": 2,
  Spacing: 3,
  "Border Radii": 1,
  "Box Shadows": 0.5,
  "z-index": 0.5,
};

function computeConfidence(
  elementCount: number,
  aggressiveMode?: boolean
): { level: "low" | "medium" | "high"; note: string } {
  if (aggressiveMode) {
    return {
      level: "low",
      note:
        "Page was loaded in fallback mode (no JavaScript, limited resources) — results are likely incomplete or wrong.",
    };
  }
  if (elementCount < 30) {
    return {
      level: "low",
      note: `Only ${elementCount} elements — limited confidence.`,
    };
  }
  if (elementCount < 100) {
    return {
      level: "medium",
      note: `${elementCount} elements — moderate confidence.`,
    };
  }
  return {
    level: "high",
    note: `${elementCount} elements — high confidence.`,
  };
}

export function computeScores(
  color: ColorSprawlResult,
  type: TypeSprawlResult,
  spacing: SpacingSprawlResult,
  misc: MiscSprawlResult,
  elementCount: number,
  aggressiveMode?: boolean
): AuditScores {
  // Order matters: top 5 shown in hero overview, so put the
  // highest-signal categories first.
  const categories: CategoryScore[] = [
    scoreColors(color),
    scoreSpacing(spacing),
    scoreFontSizes(type),
    scoreFontFamilies(type),
    scoreBorderRadii(misc),
    // ---- below the fold (details) ----
    scoreFontWeights(type),
    scoreLineHeights(type),
    scoreBoxShadows(misc),
    scoreZIndex(misc),
  ];

  let wSum = 0,
    wTotal = 0;
  for (const c of categories) {
    const w = WEIGHTS[c.name] ?? 1;
    wSum += c.score * w;
    wTotal += w;
  }
  const overall = Math.round(wSum / wTotal);
  const { level, note } = computeConfidence(elementCount, aggressiveMode);

  return {
    overall,
    grade: grade(overall),
    confidence: level,
    confidenceNote: note,
    categories,
  };
}
