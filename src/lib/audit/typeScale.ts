/* ---------------------------------------------------------------
   Type Scale Detection
   Detects whether font sizes follow a mathematical ratio
   and identifies outlier sizes that break the scale.
   --------------------------------------------------------------- */

import { TypeValue, TypeScaleAnalysis, TypeScaleStep } from "./types";

const KNOWN_SCALES = [
  { name: "Minor Second", ratio: 1.067 },
  { name: "Major Second", ratio: 1.125 },
  { name: "Minor Third", ratio: 1.2 },
  { name: "Major Third", ratio: 1.25 },
  { name: "Perfect Fourth", ratio: 1.333 },
  { name: "Augmented Fourth", ratio: 1.414 },
  { name: "Perfect Fifth", ratio: 1.5 },
  { name: "Golden Ratio", ratio: 1.618 },
];

export function analyzeTypeScale(fontSizes: TypeValue[]): TypeScaleAnalysis {
  const sizes = fontSizes
    .map((v) => ({ px: parseFloat(v.value) || 0, count: v.count }))
    .filter((v) => v.px > 0)
    .sort((a, b) => a.px - b.px);

  // Not enough data to detect a scale
  if (sizes.length < 3) {
    return {
      detectedRatio: null,
      scaleName: null,
      baseSize: null,
      steps: sizes.map((s) => ({
        px: s.px,
        label: "",
        fits: true,
        usage: s.count,
      })),
      outliers: [],
    };
  }

  // Find base size: the size closest to 16px (common body text)
  const baseSize = sizes.reduce((best, s) =>
    Math.abs(s.px - 16) < Math.abs(best.px - 16) ? s : best
  ).px;

  // Calculate ratios between consecutive sizes (skip duplicates)
  const uniquePx = [...new Set(sizes.map((s) => s.px))].sort((a, b) => a - b);
  const consecutiveRatios: number[] = [];
  for (let i = 1; i < uniquePx.length; i++) {
    const r = uniquePx[i] / uniquePx[i - 1];
    if (r > 1.02 && r < 2.5) consecutiveRatios.push(r);
  }

  if (consecutiveRatios.length === 0) {
    return {
      detectedRatio: null,
      scaleName: null,
      baseSize,
      steps: sizes.map((s) => ({
        px: s.px,
        label: "",
        fits: false,
        usage: s.count,
      })),
      outliers: sizes.map((s) => s.px),
    };
  }

  // Median consecutive ratio
  const sorted = [...consecutiveRatios].sort((a, b) => a - b);
  const medianRatio = sorted[Math.floor(sorted.length / 2)];

  // Find closest known scale
  let bestScale = KNOWN_SCALES[0];
  let bestDev = Infinity;
  for (const scale of KNOWN_SCALES) {
    const dev = Math.abs(medianRatio - scale.ratio);
    if (dev < bestDev) {
      bestDev = dev;
      bestScale = scale;
    }
  }

  const isKnown = bestDev < 0.04;
  const ratio = isKnown ? bestScale.ratio : Math.round(medianRatio * 1000) / 1000;
  const scaleName = isKnown ? bestScale.name : null;

  // Check each size against the scale: does it fit baseSize * ratio^n?
  const steps: TypeScaleStep[] = [];
  const outliers: number[] = [];
  const usageMap = new Map(sizes.map((s) => [s.px, s.count]));

  for (const px of uniquePx) {
    if (px <= 0) continue;
    const logR = Math.log(px / baseSize) / Math.log(ratio);
    const nearestN = Math.round(logR);
    const expected = baseSize * Math.pow(ratio, nearestN);
    const deviation = Math.abs(px - expected) / expected;
    const fits = deviation < 0.08; // within 8%

    if (!fits) outliers.push(px);

    let label = "";
    if (nearestN === 0) label = "base";
    else if (nearestN > 0) label = `+${nearestN}`;
    else label = `${nearestN}`;

    steps.push({ px, label, fits, usage: usageMap.get(px) ?? 0 });
  }

  return { detectedRatio: ratio, scaleName, baseSize, steps, outliers };
}
