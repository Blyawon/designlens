/* ---------------------------------------------------------------
   Spacing sprawl — diagnostic, not prescriptive
   Detects the grid, classifies on/off, shows the distribution.
   --------------------------------------------------------------- */

import { SampledElement, SpacingSprawlResult, TypeValue } from "./types";
import {
  findNumericNearDuplicates,
  classifyByGrid,
  computeRegionBreakdown,
} from "./analysis";

const LAYOUT_THRESHOLD = 96;

function parsePx(v: string): number {
  return parseFloat(v) || 0;
}

export function analyzeSpacingSprawl(
  elements: SampledElement[]
): SpacingSprawlResult {
  const map = new Map<string, { count: number; elements: string[] }>();

  for (const el of elements) {
    for (const v of [
      el.marginTop, el.marginRight, el.marginBottom, el.marginLeft,
      el.paddingTop, el.paddingRight, el.paddingBottom, el.paddingLeft,
      el.gap,
    ]) {
      if (!v || v === "0px" || v === "auto" || v === "normal" || v === "none")
        continue;
      let entry = map.get(v);
      if (!entry) { entry = { count: 0, elements: [] }; map.set(v, entry); }
      entry.count++;
      if (entry.elements.length < 3) entry.elements.push(el.selector);
    }
  }

  const all: TypeValue[] = Array.from(map.entries())
    .map(([value, d]) => ({ value, count: d.count, elements: d.elements }))
    .sort((a, b) => b.count - a.count);

  const allValues = all.filter((v) => parsePx(v.value) <= LAYOUT_THRESHOLD);
  const layoutValues = all.filter((v) => parsePx(v.value) > LAYOUT_THRESHOLD);

  // Detect base unit: find the GCD-like base from the most-used small values
  const small = allValues
    .filter((v) => { const px = parsePx(v.value); return px > 0 && px <= 16; })
    .sort((a, b) => b.count - a.count);

  let detectedBase = 4;
  if (small.length > 0) {
    // Check if base-8 or base-4 fits better
    const vals = allValues.map((v) => parsePx(v.value)).filter((px) => px > 0);
    const fit8 = vals.filter((px) => { const r = px % 8; return r < 0.1 || 8 - r < 0.1; }).length;
    const fit4 = vals.filter((px) => { const r = px % 4; return r < 0.1 || 4 - r < 0.1; }).length;
    detectedBase = fit8 / vals.length > 0.6 ? 8 : 4;
  }

  const { onGrid, offGrid, adherence } = classifyByGrid(allValues, detectedBase);

  const subGrid = detectedBase / 2; // e.g. 4 for base-8
  const nearDuplicates = findNumericNearDuplicates(allValues, {
    maxThreshold: 2,
    isClean: (px) => {
      const rem = px % subGrid;
      return rem < 0.1 || subGrid - rem < 0.1;
    },
  });

  return {
    allValues,
    layoutValues,
    detectedBase,
    adherence,
    onGrid,
    offGrid,
    nearDuplicates,
    regionBreakdown: computeRegionBreakdown(
      elements,
      (el) => {
        for (const v of [el.paddingTop, el.paddingBottom, el.marginTop, el.marginBottom]) {
          if (v && v !== "0px" && v !== "auto" && parsePx(v) <= LAYOUT_THRESHOLD)
            return v;
        }
        return undefined;
      },
      new Set(["0px", "auto", "normal"])
    ),
  };
}
