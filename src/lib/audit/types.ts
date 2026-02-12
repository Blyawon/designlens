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
  viewportWidth: number;
  viewportHeight: number;
  pageHeight: number;
  fontFaces: string[];
  cssTokens: CSSToken[];
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

// ---- Design Tokens (CSS Custom Properties) ----

export interface CSSToken {
  name: string;             // e.g. "--color-primary"
  value: string;            // resolved computed value
  rawValue?: string;        // original value (may reference other vars)
}

export type TokenCategory =
  | "color"
  | "typography"
  | "spacing"
  | "sizing"
  | "border"
  | "shadow"
  | "opacity"
  | "z-index"
  | "transition"
  | "other";

export interface TokenGroup {
  category: TokenCategory;
  label: string;            // display label e.g. "Colors"
  tokens: CSSToken[];
}

/* ---- Token analysis insights ---- */

export type TokenInsightSeverity = "info" | "warning" | "error";

export interface TokenNearDuplicate {
  token1: string;           // e.g. "--space-md"
  token2: string;           // e.g. "--space-base"
  value1: string;
  value2: string;
  category: TokenCategory;
  distance: string;         // human-readable, e.g. "1px" or "ΔE 2.3"
}

export interface TokenNamingIssue {
  token: string;
  expected: string;         // dominant prefix, e.g. "--color-*"
  actual: string;           // what the token uses, e.g. "--clr-*"
  category: TokenCategory;
}

export interface TokenShadowedValue {
  token: string;            // e.g. "--color-primary"
  resolvedValue: string;    // e.g. "#3b82f6"
  hardcodedCount: number;   // how many times this value appears raw in sprawl
  category: TokenCategory;
}

export interface TokenOrphan {
  token: string;
  rawValue: string;         // the broken reference
  resolvedValue: string;    // what it resolved to (empty / inherit / etc.)
  reason: string;           // human-readable explanation
}

export interface TokenScaleAnalysis {
  category: TokenCategory;
  label: string;
  detectedBase?: number;    // e.g. 4 for a 4px grid
  detectedRatio?: number;   // e.g. 1.25 for modular scale
  adherence: number;        // 0–100 %
  onScale: string[];        // token names
  offScale: string[];       // token names
}

/* Always-visible token stats — these produce output for any non-empty token set */

export interface TokenDuplicate {
  value: string;              // the shared computed value
  tokens: string[];           // 2+ token names that resolve to it
  category: TokenCategory;
}

export interface TokenCategoryStats {
  category: TokenCategory;
  label: string;
  count: number;
  uniqueValues: number;       // how many distinct computed values
  aliasedCount: number;       // tokens whose rawValue contains var()
  min?: string;               // smallest value (for numeric categories)
  max?: string;               // largest value (for numeric categories)
}

export interface TokenInsights {
  /* Always-visible stats */
  categoryStats: TokenCategoryStats[];
  duplicates: TokenDuplicate[];
  aliasingRate: number;       // 0–100, % of tokens that reference other tokens

  /* Conditional warnings (may be empty) */
  nearDuplicates: TokenNearDuplicate[];
  namingIssues: TokenNamingIssue[];
  shadowedValues: TokenShadowedValue[];
  orphans: TokenOrphan[];
  scales: TokenScaleAnalysis[];
}

export interface DesignTokensResult {
  totalCount: number;
  groups: TokenGroup[];
  insights: TokenInsights;
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
  designTokens: DesignTokensResult;
  viewportWidth: number;
  pageHeight: number;
  fontFaces: string[];
  /** Analysis steps that failed and fell back to defaults. */
  warnings: string[];
}

// ---- Progress callback for SSE ----

export type ProgressCallback = (data: {
  phase: string;
  message: string;
  progress?: number;
}) => void;
