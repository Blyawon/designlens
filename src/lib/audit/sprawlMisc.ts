/* ---------------------------------------------------------------
   Miscellaneous sprawl — diagnostic
   --------------------------------------------------------------- */

import { SampledElement, MiscSprawlResult, TypeValue } from "./types";
import { findNumericNearDuplicates } from "./analysis";

function collect(
  elements: SampledElement[],
  extractor: (el: SampledElement) => string | undefined,
  skip?: Set<string>
): TypeValue[] {
  const map = new Map<string, { count: number; elements: string[] }>();
  for (const el of elements) {
    const v = extractor(el);
    if (!v || skip?.has(v)) continue;
    let entry = map.get(v);
    if (!entry) { entry = { count: 0, elements: [] }; map.set(v, entry); }
    entry.count++;
    if (entry.elements.length < 3) entry.elements.push(el.selector);
  }
  return Array.from(map.entries())
    .map(([value, d]) => ({ value, count: d.count, elements: d.elements }))
    .sort((a, b) => b.count - a.count);
}

export function analyzeMiscSprawl(elements: SampledElement[]): MiscSprawlResult {
  const borderRadii = collect(elements, (el) => el.borderRadius, new Set(["0px"]));
  return {
    borderRadii,
    boxShadows: collect(elements, (el) => el.boxShadow, new Set(["none"])),
    borderWidths: collect(elements, (el) => el.borderWidth, new Set(["0px"])),
    zIndices: collect(elements, (el) => el.zIndex, new Set(["auto", "0"])),
    opacities: collect(elements, (el) => el.opacity, new Set(["1"])),
    transitions: collect(elements, (el) => el.transitionDuration, new Set(["0s"])),
    radiusNearDuplicates: findNumericNearDuplicates(borderRadii, {
      maxThreshold: 2,
      isClean: (px) => { const r = px % 2; return r < 0.1 || 2 - r < 0.1; },
    }),
  };
}
