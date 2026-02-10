import crypto from "crypto";
import { AuditResult, ProgressCallback } from "./types";
import { sampleDom } from "./sampleDom";
import { analyzeColorSprawl } from "./sprawlColors";
import { analyzeTypeSprawl } from "./sprawlType";
import { analyzeSpacingSprawl } from "./sprawlSpacing";
import { analyzeMiscSprawl } from "./sprawlMisc";
import { computeScores } from "./scoring";
import { generateFixPlan } from "./fixPlan";
import { analyzeTypeScale } from "./typeScale";
import { analyzeColorRoles } from "./colorRoles";
import { analyzePatterns } from "./patterns";
import { extractTextStyles } from "./textStyles";
import { analyzeTokens, HardcodedValueMap } from "./analyzeTokens";

export async function runAudit(
  url: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<AuditResult> {
  const id = crypto.randomBytes(8).toString("hex");

  const { elements, viewportWidth, pageHeight, fontFaces, cssTokens } =
    await sampleDom(url, onProgress, signal);


  /* Wrap each analysis module in try-catch so one crash doesn't
     kill the whole audit. We degrade gracefully with empty defaults. */
  function safe<T>(label: string, phase: string, fn: () => T, fallback: T): T {
    try {
      onProgress?.({ phase, message: label });
      return fn();
    } catch (err) {
      console.error(`[audit] ${phase} failed:`, err);
      return fallback;
    }
  }

  const emptyColor: import("./types").ColorSprawlResult = { uniqueCount: 0, allColors: [], clusters: [], nearDuplicates: [], hueGroups: [], proposedPalette: { neutrals: [], primary: [], accent: [] } };
  const emptyType: import("./types").TypeSprawlResult = { fontSizes: [], fontWeights: [], lineHeights: [], lineHeightRatios: [], fontFamilies: [], letterSpacings: [], sizeNearDuplicates: [], regionBreakdown: [] };
  const emptySpacing: import("./types").SpacingSprawlResult = { allValues: [], layoutValues: [], detectedBase: 8, adherence: 100, onGrid: [], offGrid: [], nearDuplicates: [], regionBreakdown: [] };
  const emptyMisc: import("./types").MiscSprawlResult = { borderRadii: [], boxShadows: [], borderWidths: [], zIndices: [], opacities: [], transitions: [], radiusNearDuplicates: [] };

  const colorSprawl = safe("Analysing colours…", "colors", () => analyzeColorSprawl(elements), emptyColor);
  const typeSprawl = safe("Analysing typography…", "type", () => analyzeTypeSprawl(elements), emptyType);
  const spacingSprawl = safe("Analysing spacing…", "spacing", () => analyzeSpacingSprawl(elements), emptySpacing);
  const miscSprawl = safe("Analysing shapes & layers…", "misc", () => analyzeMiscSprawl(elements), emptyMisc);
  const typeScale = safe("Detecting type scale…", "typeScale", () => analyzeTypeScale(typeSprawl.fontSizes), { detectedRatio: null, scaleName: null, baseSize: null, steps: [], outliers: [] });
  const colorRoles = safe("Inferring color roles…", "colorRoles", () => analyzeColorRoles(elements), { roles: [], inconsistencies: [] });
  const textStyles = safe("Extracting text styles…", "textStyles", () => extractTextStyles(elements), []);
  const patterns = safe("Mining component patterns…", "patterns", () => analyzePatterns(elements), { patterns: [], coveredElements: 0, totalElements: elements.length, coverage: 0, oneOffs: elements.length });
  /* Build a map of hardcoded values from sprawl data so token analysis
     can detect "shadowed" values — tokens whose resolved value appears
     as a raw hardcoded value in the styles. */
  const hardcodedMap: HardcodedValueMap = { colors: new Map(), values: new Map() };
  for (const c of colorSprawl.allColors) {
    const hex = c.hex.toLowerCase();
    hardcodedMap.colors.set(hex, (hardcodedMap.colors.get(hex) || 0) + c.count);
  }
  for (const v of [
    ...typeSprawl.fontSizes, ...typeSprawl.fontWeights, ...typeSprawl.lineHeights,
    ...spacingSprawl.allValues, ...miscSprawl.borderRadii, ...miscSprawl.boxShadows,
    ...miscSprawl.zIndices, ...miscSprawl.opacities,
  ]) {
    const key = v.value.toLowerCase();
    hardcodedMap.values.set(key, (hardcodedMap.values.get(key) || 0) + v.count);
  }

  const emptyInsights = { categoryStats: [], duplicates: [], aliasingRate: 0, nearDuplicates: [], namingIssues: [], shadowedValues: [], orphans: [], scales: [] };
  const designTokens = safe("Categorising design tokens…", "tokens", () => analyzeTokens(cssTokens, hardcodedMap), { totalCount: 0, groups: [], insights: emptyInsights });

  onProgress?.({ phase: "scoring", message: "Computing scores…" });
  const scores = computeScores(
    colorSprawl,
    typeSprawl,
    spacingSprawl,
    miscSprawl,
    elements.length
  );

  onProgress?.({ phase: "fixplan", message: "Generating findings…" });
  const fixPlan = generateFixPlan(colorSprawl, typeSprawl, spacingSprawl, miscSprawl);

  return {
    id,
    url,
    timestamp: new Date().toISOString(),
    elementCount: elements.length,
    scores,
    colorSprawl,
    typeSprawl,
    spacingSprawl,
    miscSprawl,
    fixPlan,
    typeScale,
    colorRoles,
    textStyles,
    patterns,
    designTokens,
    viewportWidth,
    pageHeight,
    fontFaces,
  };
}
