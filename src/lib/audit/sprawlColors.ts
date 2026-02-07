/* ---------------------------------------------------------------
   Colour sprawl analysis
   Cluster, near-duplicates, hue-based grouping, palette proposal
   --------------------------------------------------------------- */

import {
  SampledElement,
  ColorSprawlResult,
  ColorCluster,
  NearDuplicate,
  HueGroup,
  LAB,
} from "./types";
import {
  parseColor,
  rgbaToHex,
  rgbaToLab,
  deltaE,
  chroma,
  getColorName,
} from "./colorUtils";

const NEAR_DUP_THRESHOLD = 5;
const CLUSTER_THRESHOLD = 10;

/* ---- hue angle from LAB ---- */

function hueAngle(lab: LAB): number {
  let h = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  if (h < 0) h += 360;
  return h;
}

function hueGroupName(lab: LAB): string {
  if (chroma(lab) < 15) return "Neutrals";
  const h = hueAngle(lab);
  if (h < 15 || h >= 345) return "Reds";
  if (h < 45) return "Oranges";
  if (h < 75) return "Yellows";
  if (h < 150) return "Greens";
  if (h < 210) return "Cyans";
  if (h < 270) return "Blues";
  if (h < 345) return "Purples";
  return "Reds";
}

/* ---- entry point ---- */

export function analyzeColorSprawl(
  elements: SampledElement[]
): ColorSprawlResult {
  const counts = new Map<string, number>();

  const add = (raw: string | undefined) => {
    if (!raw || raw === "gradient-or-image") return;
    const parsed = parseColor(raw);
    if (!parsed || parsed.a === 0) return;
    const hex = rgbaToHex(parsed);
    counts.set(hex, (counts.get(hex) || 0) + 1);
  };

  for (const el of elements) {
    if (el.isTextElement) {
      add(el.color);
      add(el.backgroundColor);
    }
    add(el.borderColor);
  }

  const allColors = Array.from(counts.entries())
    .map(([hex, count]) => ({
      hex,
      count,
      name: getColorName(hex),
      lab: rgbaToLab(parseColor(hex)!),
    }))
    .sort((a, b) => b.count - a.count);

  /* ---- cluster ---- */

  const clusters: ColorCluster[] = [];
  const assigned = new Set<string>();

  for (const c of allColors) {
    if (assigned.has(c.hex)) continue;
    const cluster: ColorCluster = {
      representative: c.hex,
      name: c.name,
      count: c.count,
      members: [c.hex],
      lab: c.lab,
    };
    assigned.add(c.hex);

    for (const o of allColors) {
      if (assigned.has(o.hex)) continue;
      if (deltaE(c.lab, o.lab) < CLUSTER_THRESHOLD) {
        cluster.members.push(o.hex);
        cluster.count += o.count;
        assigned.add(o.hex);
      }
    }
    clusters.push(cluster);
  }

  /* ---- near-duplicates ---- */

  const nearDuplicates: NearDuplicate[] = [];
  for (let i = 0; i < allColors.length; i++) {
    for (let j = i + 1; j < allColors.length; j++) {
      const d = deltaE(allColors[i].lab, allColors[j].lab);
      if (d > 0 && d < NEAR_DUP_THRESHOLD) {
        const keep =
          allColors[i].count >= allColors[j].count
            ? allColors[i]
            : allColors[j];
        const drop = keep === allColors[i] ? allColors[j] : allColors[i];
        nearDuplicates.push({
          color1: allColors[i].hex,
          color2: allColors[j].hex,
          distance: Math.round(d * 10) / 10,
          suggestion: `Replace ${drop.hex} with ${keep.hex}`,
        });
      }
    }
  }
  nearDuplicates.sort((a, b) => a.distance - b.distance);

  /* ---- hue-based grouping ---- */

  const hueMap = new Map<string, HueGroup>();
  for (const c of allColors) {
    const group = hueGroupName(c.lab);
    if (!hueMap.has(group)) hueMap.set(group, { name: group, colors: [] });
    hueMap.get(group)!.colors.push({ hex: c.hex, count: c.count, name: c.name });
  }
  // Order: Neutrals first, then by colour wheel
  const hueOrder = [
    "Neutrals",
    "Reds",
    "Oranges",
    "Yellows",
    "Greens",
    "Cyans",
    "Blues",
    "Purples",
  ];
  const hueGroups = hueOrder
    .filter((n) => hueMap.has(n))
    .map((n) => hueMap.get(n)!);

  /* ---- palette ---- */

  const neutrals = clusters
    .filter((c) => chroma(c.lab) < 15)
    .sort((a, b) => a.lab.L - b.lab.L)
    .slice(0, 10)
    .map((c) => c.representative);

  const chromatic = clusters
    .filter((c) => chroma(c.lab) >= 15)
    .sort((a, b) => b.count - a.count);

  return {
    uniqueCount: allColors.length,
    allColors: allColors.map((c) => ({
      hex: c.hex,
      count: c.count,
      name: c.name,
    })),
    clusters,
    nearDuplicates: nearDuplicates.slice(0, 30),
    hueGroups,
    proposedPalette: {
      neutrals,
      primary: chromatic.slice(0, 3).map((c) => c.representative),
      accent: chromatic.slice(3, 6).map((c) => c.representative),
    },
  };
}
