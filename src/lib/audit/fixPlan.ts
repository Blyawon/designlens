/* ---------------------------------------------------------------
   Findings — simple diagnostic list
   Each finding flags an issue with specific values.
   No prescriptive "replace X with Y" — just point out the mess.
   --------------------------------------------------------------- */

import {
  FixAction,
  ColorSprawlResult,
  TypeSprawlResult,
  SpacingSprawlResult,
  MiscSprawlResult,
} from "./types";

function fmt(v: { value: string; count: number }): string {
  return `${v.value} (×${v.count})`;
}

export function generateFixPlan(
  color: ColorSprawlResult,
  type: TypeSprawlResult,
  spacing: SpacingSprawlResult,
  misc: MiscSprawlResult
): FixAction[] {
  const findings: FixAction[] = [];

  /* ---- Spacing off-grid ---- */
  if (spacing.offGrid.length > 0) {
    const totalUses = spacing.offGrid.reduce((s, v) => s + v.count, 0);
    findings.push({
      category: "Spacing",
      severity:
        spacing.adherence < 60
          ? "high"
          : spacing.adherence < 80
            ? "medium"
            : "low",
      title: `${spacing.offGrid.length} spacing values off the ${spacing.detectedBase}px grid`,
      description: `${totalUses} element usages don't align to the base-${spacing.detectedBase} system.`,
      items: spacing.offGrid
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(fmt),
    });
  }

  /* ---- Color near-duplicates ---- */
  if (color.nearDuplicates.length > 0) {
    findings.push({
      category: "Colors",
      severity:
        color.nearDuplicates.length > 6
          ? "high"
          : color.nearDuplicates.length > 2
            ? "medium"
            : "low",
      title: `${color.nearDuplicates.length} near-duplicate colour pairs`,
      description:
        "These colours are perceptually indistinguishable (ΔE < 5). Consider merging.",
      items: color.nearDuplicates
        .slice(0, 8)
        .map((d) => `${d.color1} ≈ ${d.color2} (ΔE ${d.distance})`),
    });
  }

  /* ---- Too many colors ---- */
  if (color.uniqueCount > 20) {
    findings.push({
      category: "Colors",
      severity: color.uniqueCount > 40 ? "high" : "medium",
      title: `${color.uniqueCount} unique colours`,
      description: "Most design systems use 10–15. Consider consolidating.",
      items: [],
    });
  }

  /* ---- Font size near-duplicates ---- */
  if (type.sizeNearDuplicates.length > 0) {
    findings.push({
      category: "Typography",
      severity: "medium",
      title: `${type.sizeNearDuplicates.length} near-duplicate font sizes`,
      description: "These sizes differ by ≤1px — likely unintentional.",
      items: type.sizeNearDuplicates.map(
        (d) => `${d.value1} ≈ ${d.value2} (Δ${d.difference}px)`
      ),
    });
  }

  /* ---- Too many font families ---- */
  if (type.fontFamilies.length > 3) {
    findings.push({
      category: "Typography",
      severity: type.fontFamilies.length > 5 ? "high" : "medium",
      title: `${type.fontFamilies.length} font families`,
      description: "Aim for 2–3: body, heading, mono.",
      items: type.fontFamilies.slice(0, 8).map(fmt),
    });
  }

  /* ---- Non-standard font weights ---- */
  const standard = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900]);
  const nonStd = type.fontWeights.filter(
    (w) => !standard.has(parseFloat(w.value) || 0)
  );
  if (nonStd.length > 0) {
    findings.push({
      category: "Typography",
      severity: "low",
      title: `${nonStd.length} non-standard font weights`,
      description: "CSS font-weight should use multiples of 100.",
      items: nonStd.map(fmt),
    });
  }

  /* ---- z-index irregularity (not count!) ---- */
  const intentionalZ = new Set([
    -1, 0, 1, 2, 10, 20, 30, 40, 50, 100, 200, 500, 999, 1000, 9999, 99999,
  ]);
  const irregularZ = misc.zIndices.filter((z) => {
    const n = parseInt(z.value) || 0;
    return !intentionalZ.has(n) && n % 10 !== 0;
  });
  if (irregularZ.length > 0) {
    findings.push({
      category: "Layering",
      severity: "low",
      title: `${irregularZ.length} irregular z-index values`,
      description:
        "These don't follow a named scale pattern (multiples of 10, or standard values like 1, 100, 9999).",
      items: irregularZ.map((z) => z.value),
    });
  }

  /* ---- Border radius irregularity (not count!) ---- */
  const irregularRadii = misc.borderRadii.filter((r) => {
    const px = parseFloat(r.value) || 0;
    if (px === 0 || px >= 999) return false; // 0 and "full round" are fine
    const rem = px % 2;
    return rem >= 0.1 && 2 - rem >= 0.1; // not an even number
  });
  if (irregularRadii.length > 0) {
    findings.push({
      category: "Shape",
      severity: irregularRadii.length > 4 ? "medium" : "low",
      title: `${irregularRadii.length} irregular border-radius values`,
      description:
        "These aren't multiples of 2px — likely unintentional or inherited from a different system.",
      items: irregularRadii.slice(0, 10).map(fmt),
    });
  }

  /* ---- Spacing near-duplicates ---- */
  if (spacing.nearDuplicates.length > 0) {
    findings.push({
      category: "Spacing",
      severity: "low",
      title: `${spacing.nearDuplicates.length} near-duplicate spacing pairs`,
      description: "These values are very close and one isn't on the grid.",
      items: spacing.nearDuplicates.map(
        (d) => `${d.value1} ≈ ${d.value2} (Δ${d.difference}px)`
      ),
    });
  }

  // Sort: high first, then medium, then low
  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return findings;
}
