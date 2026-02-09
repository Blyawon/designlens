import crypto from "crypto";
import { AuditResult, ProgressCallback, ScreenshotAnnotation } from "./types";
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
import { saveScreenshot } from "../store";

function buildAnnotations(
  elements: import("./types").SampledElement[],
  spacingSprawl: import("./types").SpacingSprawlResult
): ScreenshotAnnotation[] {
  const annotations: ScreenshotAnnotation[] = [];

  const offGridValues = new Set(spacingSprawl.offGrid.map((v) => v.value));
  for (const el of elements) {
    if (!el.boundingBox || el.boundingBox.width < 5) continue;
    const spacingVals = [
      el.marginTop, el.marginRight, el.marginBottom, el.marginLeft,
      el.paddingTop, el.paddingRight, el.paddingBottom, el.paddingLeft,
      el.gap,
    ];
    const offGridHits = spacingVals.filter((v) => v && offGridValues.has(v));
    if (offGridHits.length > 0) {
      annotations.push({
        selector: el.selector,
        boundingBox: el.boundingBox,
        issue: `Off-grid spacing: ${offGridHits.join(", ")}`,
        color: "rgba(245,166,35,0.5)",
      });
    }
  }

  return annotations.slice(0, 80);
}

export async function runAudit(
  url: string,
  onProgress?: ProgressCallback
): Promise<AuditResult> {
  const id = crypto.randomBytes(8).toString("hex");

  const { elements, screenshot, viewportWidth, pageHeight, fontFaces } =
    await sampleDom(url, onProgress);

  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (!isServerless && screenshot.length > 0) {
    onProgress?.({ phase: "screenshot", message: "Saving screenshot…" });
    await saveScreenshot(id, screenshot);
  }

  onProgress?.({ phase: "colors", message: "Analysing colours…" });
  const colorSprawl = analyzeColorSprawl(elements);

  onProgress?.({ phase: "type", message: "Analysing typography…" });
  const typeSprawl = analyzeTypeSprawl(elements);

  onProgress?.({ phase: "spacing", message: "Analysing spacing…" });
  const spacingSprawl = analyzeSpacingSprawl(elements);

  onProgress?.({ phase: "misc", message: "Analysing shapes & layers…" });
  const miscSprawl = analyzeMiscSprawl(elements);

  onProgress?.({ phase: "typeScale", message: "Detecting type scale…" });
  const typeScale = analyzeTypeScale(typeSprawl.fontSizes);

  onProgress?.({ phase: "colorRoles", message: "Inferring color roles…" });
  const colorRoles = analyzeColorRoles(elements);

  onProgress?.({ phase: "textStyles", message: "Extracting text styles…" });
  const textStyles = extractTextStyles(elements);

  onProgress?.({ phase: "patterns", message: "Mining component patterns…" });
  const patterns = analyzePatterns(elements);

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

  const annotations = buildAnnotations(elements, spacingSprawl);

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
    annotations,
    screenshotId: id,
    viewportWidth,
    pageHeight,
    fontFaces,
  };
}
