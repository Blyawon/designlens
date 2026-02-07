/* ---------------------------------------------------------------
   Text Style Extraction
   Collects distinct (size + weight + family + line-height) combos
   from sampled text elements. This produces a visual type palette.
   --------------------------------------------------------------- */

import { SampledElement, TextStyle } from "./types";

export function extractTextStyles(elements: SampledElement[]): TextStyle[] {
  const text = elements.filter((el) => el.isTextElement);

  // Key: "fontSize|fontWeight|fontFamily" — the visually distinct combo
  const map = new Map<
    string,
    {
      fontSize: string;
      fontWeight: string;
      fontFamily: string;
      lineHeight: string;
      letterSpacing: string;
      color: string;
      count: number;
      elements: string[];
    }
  >();

  for (const el of text) {
    if (!el.fontSize || !el.fontWeight) continue;

    // Normalize font family: take only the first family name, strip quotes
    const rawFamily = el.fontFamily ?? "sans-serif";
    const family = rawFamily
      .split(",")[0]
      .trim()
      .replace(/^["']|["']$/g, "");

    const key = `${el.fontSize}|${el.fontWeight}|${family}`;

    if (!map.has(key)) {
      map.set(key, {
        fontSize: el.fontSize,
        fontWeight: el.fontWeight,
        fontFamily: family,
        lineHeight: el.lineHeight ?? "normal",
        letterSpacing: el.letterSpacing ?? "normal",
        color: el.color ?? "rgb(0, 0, 0)",
        count: 0,
        elements: [],
      });
    }

    const entry = map.get(key)!;
    entry.count++;
    if (entry.elements.length < 5) {
      entry.elements.push(el.selector);
    }
  }

  // Sort by font size descending (largest first = heading → body → small)
  return Array.from(map.values())
    .sort((a, b) => {
      const pxA = parseFloat(a.fontSize) || 0;
      const pxB = parseFloat(b.fontSize) || 0;
      if (pxB !== pxA) return pxB - pxA;
      // Same size: heavier weight first
      const wA = parseFloat(a.fontWeight) || 400;
      const wB = parseFloat(b.fontWeight) || 400;
      return wB - wA;
    })
    .slice(0, 30); // cap at 30 distinct styles
}
