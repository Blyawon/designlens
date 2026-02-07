/* ---------------------------------------------------------------
   Types for Designlens
   --------------------------------------------------------------- */

// ---- Raw DOM sampling ----

export interface SampledElement {
  selector: string;
  tag: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  fontFamily?: string;
  letterSpacing?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  gap?: string;
  borderRadius?: string;
  boxShadow?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderColor?: string;
  zIndex?: string;
  opacity?: string;
  transitionDuration?: string;
  transitionTimingFunction?: string;
  isTextElement: boolean;
  region?: string;
  boundingBox?: { width: number; height: number; top: number; left: number };
}

export interface SampleResult {
  elements: SampledElement[];
  screenshot: Buffer;
  viewportWidth: number;
  viewportHeight: number;
  pageHeight: number;
  fontFaces: string[];
}

// ---- Colour primitives ----

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface LAB {
  L: number;
  a: number;
  b: number;
}

// ---- Shared value type ----

export interface TypeValue {
  value: string;
  count: number;
  elements: string[];
}

// ---- Analysis primitives ----

export interface NumericNearDuplicate {
  value1: string;
  value2: string;
  px1: number;
  px2: number;
  difference: number;
  suggestion: string;
  affectedElements: number;
}

export interface RegionBreakdown {
  region: string;
  values: string[];
  uniqueToRegion: string[];
  totalCount: number;
}

// ---- Colour sprawl ----

export interface ColorCluster {
  representative: string;
  name: string;
  count: number;
  members: string[];
  lab: LAB;
}

export interface NearDuplicate {
  color1: string;
  color2: string;
  distance: number;
  suggestion: string;
}

export interface HueGroup {
  name: string;
  colors: { hex: string; count: number; name: string }[];
}

export interface ColorSprawlResult {
  uniqueCount: number;
  allColors: { hex: string; count: number; name: string }[];
  clusters: ColorCluster[];
  nearDuplicates: NearDuplicate[];
  hueGroups: HueGroup[];
  proposedPalette: {
    neutrals: string[];
    primary: string[];
    accent: string[];
  };
}

// ---- Typography sprawl ----

export interface TypeSprawlResult {
  fontSizes: TypeValue[];
  fontWeights: TypeValue[];
  lineHeights: TypeValue[];
  lineHeightRatios: TypeValue[];
  fontFamilies: TypeValue[];
  letterSpacings: TypeValue[];
  sizeNearDuplicates: NumericNearDuplicate[];
  regionBreakdown: RegionBreakdown[];
}

// ---- Spacing sprawl ----

export interface SpacingSprawlResult {
  allValues: TypeValue[];
  layoutValues: TypeValue[];
  detectedBase: number;
  adherence: number;
  onGrid: TypeValue[];
  offGrid: TypeValue[];
  nearDuplicates: NumericNearDuplicate[];
  regionBreakdown: RegionBreakdown[];
}

// ---- Misc sprawl ----

export interface MiscSprawlResult {
  borderRadii: TypeValue[];
  boxShadows: TypeValue[];
  borderWidths: TypeValue[];
  zIndices: TypeValue[];
  opacities: TypeValue[];
  transitions: TypeValue[];
  radiusNearDuplicates: NumericNearDuplicate[];
}

// ---- Type Scale Analysis ----

export interface TypeScaleStep {
  px: number;
  label: string;
  fits: boolean;
  usage: number;
}

export interface TypeScaleAnalysis {
  detectedRatio: number | null;
  scaleName: string | null;
  baseSize: number | null;
  steps: TypeScaleStep[];
  outliers: number[];
}

// ---- Color Role Detection ----

export interface ColorRoleEntry {
  hex: string;
  count: number;
  name: string;
}

export interface ColorRole {
  role: "background" | "text" | "interactive" | "border" | "accent";
  label: string;
  colors: ColorRoleEntry[];
}

export interface ColorRoleAnalysis {
  roles: ColorRole[];
  inconsistencies: string[];
}

// ---- Component Pattern Mining ----

export interface ComponentPattern {
  name: string;
  properties: Record<string, string>;
  count: number;
  elements: string[];
  tags: string[];
  color: string; // assigned color for annotation
}

export interface PatternAnalysis {
  patterns: ComponentPattern[];
  coveredElements: number;
  totalElements: number;
  coverage: number;
  oneOffs: number;
}

// ---- Screenshot Annotations ----

export interface ScreenshotAnnotation {
  selector: string;
  boundingBox: { top: number; left: number; width: number; height: number };
  issue: string;
  color: string;
}

// ---- Scoring ----

export interface ScoreSignal {
  name: string;
  value: number;
  label: string;
}

export interface CategoryScore {
  name: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  signals: ScoreSignal[];
}

export interface AuditScores {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  confidence: "low" | "medium" | "high";
  confidenceNote: string;
  categories: CategoryScore[];
}

// ---- Findings (fix plan) ----

export interface FixAction {
  category: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  items: string[];
}

// ---- Type Palette (style combinations) ----

export interface TextStyle {
  fontSize: string;
  fontWeight: string;
  fontFamily: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  count: number;
  elements: string[];
}

// ---- Full audit result ----

export interface AuditResult {
  id: string;
  url: string;
  timestamp: string;
  elementCount: number;
  scores: AuditScores;
  colorSprawl: ColorSprawlResult;
  typeSprawl: TypeSprawlResult;
  spacingSprawl: SpacingSprawlResult;
  miscSprawl: MiscSprawlResult;
  fixPlan: FixAction[];
  typeScale: TypeScaleAnalysis;
  colorRoles: ColorRoleAnalysis;
  textStyles: TextStyle[];
  patterns: PatternAnalysis;
  annotations: ScreenshotAnnotation[];
  screenshotId?: string;
  viewportWidth: number;
  pageHeight: number;
  fontFaces: string[];
}

// ---- Progress callback for SSE ----

export type ProgressCallback = (data: {
  phase: string;
  message: string;
  progress?: number;
}) => void;
