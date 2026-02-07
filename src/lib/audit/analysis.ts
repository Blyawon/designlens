/* ---------------------------------------------------------------
   Shared analysis primitives
   --------------------------------------------------------------- */

import {
  TypeValue,
  SampledElement,
  NumericNearDuplicate,
  RegionBreakdown,
} from "./types";

/* ---- Near-duplicate detection (greedy, skip clean pairs) ---- */

export function findNumericNearDuplicates(
  values: TypeValue[],
  opts: {
    maxThreshold?: number;
    maxRelative?: number;
    isClean?: (px: number) => boolean;
  } = {}
): NumericNearDuplicate[] {
  const { maxThreshold = 2, maxRelative = 0.12, isClean } = opts;

  const parsed = values
    .map((v) => ({ ...v, px: parseFloat(v.value) || 0 }))
    .filter((v) => v.px > 0)
    .sort((a, b) => a.px - b.px);

  const candidates: { i: number; j: number; diff: number }[] = [];
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const diff = parsed[j].px - parsed[i].px;
      if (diff > maxThreshold) break;
      if (diff <= 0) continue;
      // Skip if both values are "clean" (both on-grid / both round)
      if (isClean && isClean(parsed[i].px) && isClean(parsed[j].px)) continue;
      // Skip if relative difference is too large — these are intentionally
      // different values, not sub-pixel rounding errors.
      // e.g. 6px vs 7px = 14% → intentional. 13.8px vs 14px = 1.3% → rounding.
      const relDiff = diff / parsed[j].px;
      if (relDiff > maxRelative) continue;
      candidates.push({ i, j, diff });
    }
  }

  candidates.sort((a, b) => a.diff - b.diff);
  const used = new Set<number>();
  const dups: NumericNearDuplicate[] = [];

  for (const c of candidates) {
    if (used.has(c.i) || used.has(c.j)) continue;
    used.add(c.i);
    used.add(c.j);

    const keep =
      parsed[c.i].count >= parsed[c.j].count ? parsed[c.i] : parsed[c.j];
    const drop = keep === parsed[c.i] ? parsed[c.j] : parsed[c.i];

    dups.push({
      value1: parsed[c.i].value,
      value2: parsed[c.j].value,
      px1: parsed[c.i].px,
      px2: parsed[c.j].px,
      difference: Math.round(c.diff * 10) / 10,
      suggestion: `Replace ${drop.value} with ${keep.value}`,
      affectedElements: drop.count,
    });
  }

  return dups.sort((a, b) => b.affectedElements - a.affectedElements);
}

/* ---- Grid classification ---- */
// A base-8 grid system legitimately uses 4px half-steps (4, 12, 20, 28…).
// So "on grid" means multiples of base/2 — the sub-grid.
// This matches how real design systems work: base-8 with 4px fine-tuning.

export function classifyByGrid(
  values: TypeValue[],
  base: number
): { onGrid: TypeValue[]; offGrid: TypeValue[]; adherence: number } {
  const subGrid = base / 2; // e.g. 4 for base-8, 2 for base-4
  const onGrid: TypeValue[] = [];
  const offGrid: TypeValue[] = [];

  let onGridUsages = 0;
  let totalUsages = 0;

  for (const v of values) {
    const px = parseFloat(v.value) || 0;
    if (px <= 0) continue;
    totalUsages += v.count;
    const rem = px % subGrid;
    const isOn = rem < 0.1 || subGrid - rem < 0.1;
    if (isOn) {
      onGrid.push(v);
      onGridUsages += v.count;
    } else {
      offGrid.push(v);
    }
  }

  const adherence =
    totalUsages > 0 ? Math.round((onGridUsages / totalUsages) * 100) : 100;

  return { onGrid, offGrid, adherence };
}

/* ---- Per-region breakdown ---- */

export function computeRegionBreakdown(
  elements: SampledElement[],
  extractor: (el: SampledElement) => string | undefined,
  skip?: Set<string>
): RegionBreakdown[] {
  const regionVals = new Map<string, Set<string>>();
  const valRegions = new Map<string, Set<string>>();

  for (const el of elements) {
    const val = extractor(el);
    if (!val || skip?.has(val)) continue;
    const region = el.region || "body";

    if (!regionVals.has(region)) regionVals.set(region, new Set());
    regionVals.get(region)!.add(val);

    if (!valRegions.has(val)) valRegions.set(val, new Set());
    valRegions.get(val)!.add(region);
  }

  return Array.from(regionVals.entries())
    .map(([region, vals]) => {
      const values = Array.from(vals);
      return {
        region,
        values,
        uniqueToRegion: values.filter((v) => valRegions.get(v)!.size === 1),
        totalCount: values.length,
      };
    })
    .filter((r) => r.uniqueToRegion.length > 0)
    .sort((a, b) => b.uniqueToRegion.length - a.uniqueToRegion.length);
}
