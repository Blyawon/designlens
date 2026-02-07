/* ---------------------------------------------------------------
   Component Pattern Mining
   Finds recurring style "fingerprints" across sampled elements
   and identifies implicit component patterns.
   --------------------------------------------------------------- */

import { SampledElement, ComponentPattern, PatternAnalysis } from "./types";

const PATTERN_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#f97316", // orange
];

function isDefault(prop: string, val: string | undefined): boolean {
  if (!val) return true;
  const v = val.trim().toLowerCase();
  switch (prop) {
    case "backgroundColor":
      return (
        v === "transparent" ||
        v === "rgba(0, 0, 0, 0)" ||
        v === "" ||
        v === "rgb(255, 255, 255)" ||
        v === "rgb(0, 0, 0)"
      );
    case "borderWidth":
      return v === "0px" || v === "";
    case "borderRadius":
      return v === "0px" || v === "";
    case "boxShadow":
      return v === "none" || v === "";
    case "fontWeight":
      return v === "400" || v === "normal" || v === "";
    case "opacity":
      return v === "1" || v === "";
    default:
      return v === "" || v === "0px" || v === "none" || v === "normal";
  }
}

function computeFingerprint(el: SampledElement): string {
  const parts: string[] = [];

  if (el.fontSize) parts.push(`fs:${el.fontSize}`);
  if (!isDefault("fontWeight", el.fontWeight)) parts.push(`fw:${el.fontWeight}`);
  if (!isDefault("backgroundColor", el.backgroundColor))
    parts.push(`bg:${el.backgroundColor}`);
  if (el.color && el.isTextElement) parts.push(`c:${el.color}`);
  if (!isDefault("borderRadius", el.borderRadius))
    parts.push(`br:${el.borderRadius}`);
  if (!isDefault("boxShadow", el.boxShadow)) parts.push(`sh:1`);
  if (!isDefault("borderWidth", el.borderWidth))
    parts.push(`bw:${el.borderWidth}`);

  // Padding (combined as shorthand)
  const pad = [el.paddingTop, el.paddingRight, el.paddingBottom, el.paddingLeft]
    .map((v) => v || "0px")
    .join(" ");
  if (pad !== "0px 0px 0px 0px") parts.push(`p:${pad}`);

  return parts.sort().join("|");
}

function namePattern(
  tags: string[],
  props: Record<string, string>,
  existing: Map<string, number>
): string {
  const tagSet = new Set(tags);

  let base = "Element";
  if (tagSet.has("button")) base = "Button";
  else if (tagSet.has("a")) base = "Link";
  else if (["h1", "h2", "h3", "h4", "h5", "h6"].some((h) => tagSet.has(h)))
    base = "Heading";
  else if (tagSet.has("input") || tagSet.has("textarea") || tagSet.has("select"))
    base = "Input";
  else if (tagSet.has("li")) base = "List Item";
  else if (tagSet.has("img")) base = "Image";
  else if (props["sh:1"]) base = "Card";
  else if (props.bg) base = "Surface";
  else if (props.bw) base = "Bordered";
  else if (tagSet.has("p") || tagSet.has("span")) base = "Text";

  const n = (existing.get(base) ?? 0) + 1;
  existing.set(base, n);
  return n > 1 ? `${base} ${n}` : base;
}

export function analyzePatterns(elements: SampledElement[]): PatternAnalysis {
  // 1. Compute fingerprints
  const groups = new Map<string, SampledElement[]>();
  for (const el of elements) {
    const fp = computeFingerprint(el);
    if (!fp) continue; // skip elements with no distinctive properties
    if (!groups.has(fp)) groups.set(fp, []);
    groups.get(fp)!.push(el);
  }

  // 2. Filter: a "pattern" needs at least 3 instances
  const patternGroups = Array.from(groups.entries())
    .filter(([, els]) => els.length >= 3)
    .sort(([, a], [, b]) => b.length - a.length);

  // 3. Build pattern objects
  const nameCounter = new Map<string, number>();
  const patterns: ComponentPattern[] = [];
  let coveredElements = 0;

  for (let i = 0; i < patternGroups.length && i < 20; i++) {
    const [fp, els] = patternGroups[i];
    const tags = [...new Set(els.map((e) => e.tag?.toLowerCase() ?? "div"))];

    // Parse fingerprint back into properties for display
    const properties: Record<string, string> = {};
    for (const part of fp.split("|")) {
      const [k, ...rest] = part.split(":");
      properties[k] = rest.join(":");
    }

    const name = namePattern(tags, properties, nameCounter);
    const color = PATTERN_COLORS[i % PATTERN_COLORS.length];

    patterns.push({
      name,
      properties,
      count: els.length,
      elements: els.slice(0, 8).map((e) => e.selector),
      tags,
      color,
    });

    coveredElements += els.length;
  }

  const totalElements = elements.length;
  const oneOffs = totalElements - coveredElements;
  const coverage = totalElements > 0
    ? Math.round((coveredElements / totalElements) * 100)
    : 0;

  return { patterns, coveredElements, totalElements, coverage, oneOffs };
}
