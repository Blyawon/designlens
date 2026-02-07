/* ---------------------------------------------------------------
   Color math: parsing, sRGB→LAB, Delta-E, naming, compositing
   --------------------------------------------------------------- */

import { RGBA, LAB } from "./types";

// ---- Parsing --------------------------------------------------------

export function parseColor(color: string): RGBA | null {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // rgb(r, g, b) / rgba(r, g, b, a)
  const rgbaMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // hex — #rgb, #rrggbb, #rrggbbaa
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const h = hexMatch[1];
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
        a: 1,
      };
    }
    if (h.length === 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: 1,
      };
    }
    if (h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: parseInt(h.slice(6, 8), 16) / 255,
      };
    }
  }

  return null;
}

// ---- Compositing ----------------------------------------------------

export function compositeAlpha(fg: RGBA, bg: RGBA): RGBA {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
    g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
    b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
    a,
  };
}

// ---- Conversions ----------------------------------------------------

export function rgbaToHex(c: RGBA): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(c.r).toString(16).padStart(2, "0");
  const g = clamp(c.g).toString(16).padStart(2, "0");
  const b = clamp(c.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToXyz(c: RGBA): [number, number, number] {
  const r = srgbToLinear(c.r);
  const g = srgbToLinear(c.g);
  const b = srgbToLinear(c.b);
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ];
}

function xyzToLab([x, y, z]: [number, number, number]): LAB {
  const xn = 0.95047,
    yn = 1.0,
    zn = 1.08883;
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function rgbaToLab(c: RGBA): LAB {
  return xyzToLab(rgbToXyz(c));
}

// ---- Distance -------------------------------------------------------

/** CIE76 Delta-E — perceptual colour distance */
export function deltaE(a: LAB, b: LAB): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

/** Chroma (colourfulness) from LAB */
export function chroma(lab: LAB): number {
  return Math.sqrt(lab.a ** 2 + lab.b ** 2);
}

// ---- Human-readable name -------------------------------------------

const COLOR_NAMES: [string, RGBA][] = [
  ["white", { r: 255, g: 255, b: 255, a: 1 }],
  ["black", { r: 0, g: 0, b: 0, a: 1 }],
  ["gray", { r: 128, g: 128, b: 128, a: 1 }],
  ["light gray", { r: 192, g: 192, b: 192, a: 1 }],
  ["dark gray", { r: 64, g: 64, b: 64, a: 1 }],
  ["red", { r: 255, g: 0, b: 0, a: 1 }],
  ["dark red", { r: 139, g: 0, b: 0, a: 1 }],
  ["orange", { r: 255, g: 165, b: 0, a: 1 }],
  ["yellow", { r: 255, g: 255, b: 0, a: 1 }],
  ["green", { r: 0, g: 128, b: 0, a: 1 }],
  ["dark green", { r: 0, g: 100, b: 0, a: 1 }],
  ["lime", { r: 0, g: 255, b: 0, a: 1 }],
  ["teal", { r: 0, g: 128, b: 128, a: 1 }],
  ["cyan", { r: 0, g: 255, b: 255, a: 1 }],
  ["blue", { r: 0, g: 0, b: 255, a: 1 }],
  ["dark blue", { r: 0, g: 0, b: 139, a: 1 }],
  ["navy", { r: 0, g: 0, b: 128, a: 1 }],
  ["purple", { r: 128, g: 0, b: 128, a: 1 }],
  ["pink", { r: 255, g: 192, b: 203, a: 1 }],
  ["magenta", { r: 255, g: 0, b: 255, a: 1 }],
  ["brown", { r: 139, g: 69, b: 19, a: 1 }],
  ["beige", { r: 245, g: 245, b: 220, a: 1 }],
  ["salmon", { r: 250, g: 128, b: 114, a: 1 }],
  ["coral", { r: 255, g: 127, b: 80, a: 1 }],
  ["indigo", { r: 75, g: 0, b: 130, a: 1 }],
  ["violet", { r: 238, g: 130, b: 238, a: 1 }],
  ["olive", { r: 128, g: 128, b: 0, a: 1 }],
];

const COLOR_NAME_LABS = COLOR_NAMES.map(
  ([name, rgba]) => [name, rgbaToLab(rgba)] as const
);

export function getColorName(hex: string): string {
  const rgba = parseColor(hex);
  if (!rgba) return "unknown";
  const lab = rgbaToLab(rgba);

  let bestName = "unknown";
  let bestDist = Infinity;

  for (const [name, refLab] of COLOR_NAME_LABS) {
    const d = deltaE(lab, refLab);
    if (d < bestDist) {
      bestDist = d;
      bestName = name;
    }
  }

  // Add lightness qualifier if not already present
  const skip =
    /light|white|beige|ivory|dark|black|navy/.test(bestName);
  if (!skip && lab.L > 85) bestName = `light ${bestName}`;
  else if (!skip && lab.L < 25) bestName = `dark ${bestName}`;

  return bestName;
}
