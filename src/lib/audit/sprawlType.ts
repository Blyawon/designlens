/* ---------------------------------------------------------------
   Typography sprawl — diagnostic
   Collects distribution, detects near-dupes, no proposed scale.
   --------------------------------------------------------------- */

import { SampledElement, TypeSprawlResult, TypeValue } from "./types";
import { findNumericNearDuplicates, computeRegionBreakdown } from "./analysis";

function collect(
  elements: SampledElement[],
  extractor: (el: SampledElement) => string | undefined,
  skip?: Set<string>
): TypeValue[] {
  const map = new Map<string, { count: number; elements: string[] }>();
  for (const el of elements) {
    const v = extractor(el);
    if (!v || v === "normal" || v === "none" || v === "0px") continue;
    if (skip?.has(v)) continue;
    let entry = map.get(v);
    if (!entry) { entry = { count: 0, elements: [] }; map.set(v, entry); }
    entry.count++;
    if (entry.elements.length < 5) entry.elements.push(el.selector);
  }
  return Array.from(map.entries())
    .map(([value, d]) => ({ value, count: d.count, elements: d.elements }))
    .sort((a, b) => b.count - a.count);
}

/** Compute line-height / font-size ratios, rounded to 1 decimal place.
 *  This groups "24px on 16px" and "27px on 18px" together as ratio 1.5,
 *  which is what the designer actually specified. */
function collectLineHeightRatios(elements: SampledElement[]): TypeValue[] {
  const map = new Map<string, { count: number; elements: string[] }>();
  for (const el of elements) {
    if (!el.lineHeight || !el.fontSize) continue;
    if (el.lineHeight === "normal" || el.lineHeight === "none") continue;
    const lh = parseFloat(el.lineHeight);
    const fs = parseFloat(el.fontSize);
    if (!lh || !fs || fs < 1 || lh < 1) continue;
    const ratio = (lh / fs).toFixed(1);
    let entry = map.get(ratio);
    if (!entry) {
      entry = { count: 0, elements: [] };
      map.set(ratio, entry);
    }
    entry.count++;
    if (entry.elements.length < 5) entry.elements.push(el.selector);
  }
  return Array.from(map.entries())
    .map(([value, d]) => ({ value, count: d.count, elements: d.elements }))
    .sort((a, b) => b.count - a.count);
}

export function analyzeTypeSprawl(
  elements: SampledElement[]
): TypeSprawlResult {
  const text = elements.filter((el) => el.isTextElement);

  return {
    fontSizes: collect(text, (el) => el.fontSize),
    fontWeights: collect(text, (el) => el.fontWeight),
    lineHeights: collect(text, (el) => el.lineHeight),
    lineHeightRatios: collectLineHeightRatios(text),
    fontFamilies: collect(text, (el) => {
      if (!el.fontFamily) return undefined;
      return el.fontFamily.split(",")[0].trim().replace(/['"]/g, "");
    }),
    letterSpacings: collect(text, (el) => el.letterSpacing, new Set(["normal"])),
    sizeNearDuplicates: findNumericNearDuplicates(
      collect(text, (el) => el.fontSize),
      { maxThreshold: 1, isClean: (px) => Math.abs(px - Math.round(px)) < 0.1 }
    ),
    regionBreakdown: computeRegionBreakdown(text, (el) => el.fontSize, new Set(["0px"])),
  };
}
