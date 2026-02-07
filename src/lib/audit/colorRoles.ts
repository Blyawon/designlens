/* ---------------------------------------------------------------
   Color Role Detection
   Infers how colors are used (text, background, interactive, etc.)
   from the element context they appear on.
   --------------------------------------------------------------- */

import { SampledElement, ColorRoleAnalysis, ColorRole, ColorRoleEntry } from "./types";
import { parseColor, rgbaToHex, rgbaToLab, deltaE, getColorName } from "./colorUtils";

const INTERACTIVE_TAGS = new Set([
  "button", "a", "input", "select", "textarea", "label",
]);

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function normalizeToHex(raw: string | undefined): string | null {
  if (!raw || raw === "gradient-or-image") return null;
  const parsed = parseColor(raw);
  if (!parsed || parsed.a === 0) return null;
  return rgbaToHex(parsed);
}

export function analyzeColorRoles(elements: SampledElement[]): ColorRoleAnalysis {
  // Accumulate: role → hex → count
  const roleCounts = new Map<string, Map<string, number>>();

  function add(role: string, hex: string) {
    if (!roleCounts.has(role)) roleCounts.set(role, new Map());
    const m = roleCounts.get(role)!;
    m.set(hex, (m.get(hex) || 0) + 1);
  }

  for (const el of elements) {
    const tag = el.tag?.toLowerCase() ?? "";
    const isInteractive = INTERACTIVE_TAGS.has(tag);

    // Text color
    if (el.color && el.isTextElement) {
      const hex = normalizeToHex(el.color);
      if (hex) {
        if (isInteractive) {
          add("interactive", hex);
        } else {
          add("text", hex);
        }
      }
    }

    // Background color
    if (el.backgroundColor && el.backgroundColor !== "gradient-or-image") {
      const hex = normalizeToHex(el.backgroundColor);
      if (hex) {
        if (isInteractive) {
          add("interactive", hex);
        } else {
          add("background", hex);
        }
      }
    }

    // Border color
    if (el.borderColor && el.borderWidth && el.borderWidth !== "0px") {
      const hex = normalizeToHex(el.borderColor);
      if (hex) add("border", hex);
    }
  }

  // Build role entries, sorted by count
  const roleLabels: Record<string, string> = {
    background: "Background",
    text: "Text",
    interactive: "Interactive",
    border: "Border",
  };

  const roles: ColorRole[] = [];
  for (const [role, hexMap] of roleCounts) {
    const colors: ColorRoleEntry[] = Array.from(hexMap.entries())
      .map(([hex, count]) => ({ hex, count, name: getColorName(hex) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    if (colors.length > 0) {
      roles.push({
        role: role as ColorRole["role"],
        label: roleLabels[role] ?? role,
        colors,
      });
    }
  }

  // Sort: background first, then text, interactive, border
  const roleOrder = ["background", "text", "interactive", "border", "accent"];
  roles.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));

  // Detect inconsistencies
  const inconsistencies: string[] = [];

  // Check interactive colors: if >2 visually distinct colors, flag it
  const interactive = roleCounts.get("interactive");
  if (interactive && interactive.size > 1) {
    const hexes = Array.from(interactive.keys());
    const labs = hexes.map((h) => ({ hex: h, lab: rgbaToLab(parseColor(h)!) }));
    // Count distinct clusters (ΔE > 15)
    const clusters: string[][] = [];
    const assigned = new Set<string>();
    for (const c of labs) {
      if (assigned.has(c.hex)) continue;
      const cluster = [c.hex];
      assigned.add(c.hex);
      for (const o of labs) {
        if (assigned.has(o.hex)) continue;
        if (deltaE(c.lab, o.lab) < 15) {
          cluster.push(o.hex);
          assigned.add(o.hex);
        }
      }
      clusters.push(cluster);
    }
    if (clusters.length > 2) {
      inconsistencies.push(
        `${clusters.length} distinct colors on interactive elements — are they all intentional?`
      );
    }
  }

  // Check text colors
  const textColors = roleCounts.get("text");
  if (textColors && textColors.size > 6) {
    inconsistencies.push(
      `${textColors.size} different text colors — most systems use 3–4 (primary, secondary, muted, link).`
    );
  }

  // Check background colors
  const bgColors = roleCounts.get("background");
  if (bgColors && bgColors.size > 5) {
    inconsistencies.push(
      `${bgColors.size} different background colors — consider a tighter surface palette.`
    );
  }

  return { roles, inconsistencies };
}
