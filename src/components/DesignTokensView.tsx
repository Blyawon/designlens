"use client";

import React, { useState } from "react";
import {
  DesignTokensResult, TokenGroup, CSSToken, TokenCategory,
  TokenInsights, TokenNearDuplicate, TokenShadowedValue,
  TokenScaleAnalysis, TokenDuplicate, TokenCategoryStats,
} from "@/lib/audit/types";

/* ----------------------------------------------------------------
   Category icons — simple inline SVGs that convey the token type
   at a glance without pulling in an icon library.
   ---------------------------------------------------------------- */

const CATEGORY_ICONS: Record<TokenCategory, React.JSX.Element> = {
  color: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="5.5" />
      <circle cx="7" cy="7" r="2" />
    </svg>
  ),
  typography: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h8M7 3v8M5 11h4" />
    </svg>
  ),
  spacing: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2v10M12 2v10M2 7h10" />
      <path d="M4 5.5l-2 1.5 2 1.5M10 5.5l2 1.5-2 1.5" />
    </svg>
  ),
  sizing: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="10" height="10" rx="1.5" />
      <path d="M2 7h10M7 2v10" />
    </svg>
  ),
  border: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="10" height="10" rx="3" />
    </svg>
  ),
  shadow: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="8" height="8" rx="1.5" />
      <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" opacity="0.35" />
    </svg>
  ),
  opacity: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="5.5" />
      <path d="M7 1.5v11" />
      <path d="M7 1.5A5.5 5.5 0 0 1 7 12.5" fill="currentColor" opacity="0.15" />
    </svg>
  ),
  "z-index": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="6" height="6" rx="1" />
      <rect x="4" y="3.5" width="6" height="6" rx="1" opacity="0.6" />
      <rect x="7" y="1" width="6" height="6" rx="1" opacity="0.3" />
    </svg>
  ),
  transition: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 11c2-1 3-8 10-8" />
    </svg>
  ),
  other: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="1" fill="currentColor" />
      <circle cx="3" cy="7" r="1" fill="currentColor" />
      <circle cx="11" cy="7" r="1" fill="currentColor" />
    </svg>
  ),
};

/* ----------------------------------------------------------------
   Colour rendering helpers
   ---------------------------------------------------------------- */

const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FN_RE = /^(?:rgba?|hsla?|oklch|oklab|lch|lab|color|hwb)\s*\(/i;

function isVisualColor(value: string): boolean {
  const v = value.trim();
  if (HEX_RE.test(v)) return true;
  if (COLOR_FN_RE.test(v)) return true;
  return false;
}

/* ----------------------------------------------------------------
   Copy-to-clipboard helper with toast
   ---------------------------------------------------------------- */

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      onClick={copy}
      className="text-[11px] text-ds-tertiary hover:text-ds-secondary transition-colors duration-150 cursor-pointer shrink-0"
      title={`Copy ${label}`}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-ds-olive">
          <path d="M2.5 7L5 9.5L10.5 3.5" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4.5" y="4.5" width="6" height="6" rx="1" />
          <path d="M8.5 4.5V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v4.5a1 1 0 0 0 1 1h1.5" />
        </svg>
      )}
    </button>
  );
}

/* ----------------------------------------------------------------
   Individual token row
   ---------------------------------------------------------------- */

function TokenRow({ token, isColor }: { token: CSSToken; isColor: boolean }) {
  const displayName = token.name;
  const varRef = `var(${token.name})`;
  const showSwatch = isColor && isVisualColor(token.value);

  return (
    <div className="group flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface-subtle transition-colors duration-100">
      {showSwatch && (
        <span
          className="w-5 h-5 rounded-md border border-border shrink-0 shadow-sm"
          style={{ backgroundColor: token.value }}
        />
      )}

      {isColor && !showSwatch && <span className="w-5 shrink-0" />}

      <span className="font-mono text-xs text-ds-secondary truncate min-w-0 flex-1">
        {displayName}
      </span>

      <span className="font-mono text-[11px] text-ds-tertiary truncate max-w-[12rem] sm:max-w-[18rem] text-right" title={token.value}>
        {token.value}
      </span>

      {token.rawValue && (
        <span
          className="hidden sm:inline text-[10px] text-ds-tertiary/60 truncate max-w-[8rem]"
          title={`Raw: ${token.rawValue}`}
        >
          ← {token.rawValue}
        </span>
      )}

      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <CopyButton text={varRef} label={displayName} />
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------
   Category group — always visible (no nested accordion)
   ---------------------------------------------------------------- */

function CategoryGroup({ group }: { group: TokenGroup }) {
  const isColor = group.category === "color";

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Static header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-ds-tertiary shrink-0">
          {CATEGORY_ICONS[group.category]}
        </span>
        <span className="text-sm font-medium text-ds-primary flex-1">
          {group.label}
        </span>
        <span className="text-[11px] font-mono text-ds-tertiary bg-surface-subtle px-2 py-0.5 rounded-full">
          {group.tokens.length}
        </span>
      </div>

      {/* Token list — always visible */}
      <div className="px-4 pb-3 pt-0.5">
        {isColor ? (
          <ColorTokenGrid tokens={group.tokens} />
        ) : (
          <div className="space-y-0">
            {group.tokens.map((t) => (
              <TokenRow key={t.name} token={t} isColor={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Colour token grid — shows swatches in a more visual layout
   ---------------------------------------------------------------- */

function ColorTokenGrid({ tokens }: { tokens: CSSToken[] }) {
  const withSwatch = tokens.filter((t) => isVisualColor(t.value));
  const withoutSwatch = tokens.filter((t) => !isVisualColor(t.value));

  return (
    <div className="space-y-2">
      {withSwatch.length > 0 && (
        <div
          className="grid gap-1.5 mb-3"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(2.25rem, 1fr))` }}
        >
          {withSwatch.map((t) => (
            <ColorSwatch key={t.name} token={t} />
          ))}
        </div>
      )}

      <div className="space-y-0">
        {tokens.map((t) => (
          <TokenRow key={t.name} token={t} isColor={true} />
        ))}
      </div>

      {withoutSwatch.length > 0 && withoutSwatch.length < tokens.length && (
        <p className="text-[10px] text-ds-tertiary mt-1">
          {withoutSwatch.length} token{withoutSwatch.length > 1 ? "s" : ""} with non-resolvable colour values
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
   Small colour swatch for the grid overview
   ---------------------------------------------------------------- */

function ColorSwatch({ token }: { token: CSSToken }) {
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(`var(${token.name})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const shortName = token.name
    .replace(/^--/, "")
    .replace(/^(?:color|clr|c)-/i, "")
    .replace(/-/g, " ");

  return (
    <div
      className="relative group/swatch"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={copy}
        className="w-full aspect-square rounded-lg border border-border shadow-sm cursor-pointer transition-transform duration-150 hover:scale-105"
        style={{ backgroundColor: token.value }}
        title={`${token.name}: ${token.value}`}
      />

      {hover && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 bg-bg-elevated border border-border rounded-lg px-2.5 py-1.5 shadow-lg pointer-events-none whitespace-nowrap">
          <p className="text-[10px] font-mono text-ds-secondary">
            {copied ? "Copied!" : shortName}
          </p>
          <p className="text-[10px] font-mono text-ds-tertiary">{token.value}</p>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
   Empty state — shown when the page has no CSS custom properties
   ---------------------------------------------------------------- */

function EmptyTokens() {
  return (
    <div className="py-8 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface-subtle mb-3">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-ds-tertiary">
          <path d="M3 3h4v4H3zM11 3h4v4h-4zM3 11h4v4H3z" />
          <path d="M11 11h4v4h-4z" strokeDasharray="2 2" />
        </svg>
      </div>
      <p className="text-sm text-ds-secondary mb-1">No design tokens found</p>
      <p className="text-xs text-ds-tertiary leading-relaxed max-w-xs mx-auto">
        This page doesn&apos;t use CSS custom properties (<code className="text-[11px] font-mono bg-surface-subtle px-1 py-0.5 rounded">--*</code>).
        Design tokens help keep a system consistent — colors, spacing, and typography
        defined once and reused everywhere.
      </p>
    </div>
  );
}

/* ================================================================
   INSIGHTS UI
   ================================================================ */

/* ----------------------------------------------------------------
   Severity-styled collapsible card for warnings
   ---------------------------------------------------------------- */

const SEV_STYLES = {
  error:   { bg: "bg-ds-red/8",  border: "border-ds-red/20",  icon: "text-ds-red",  label: "text-ds-red" },
  warning: { bg: "bg-ds-amber/8", border: "border-ds-amber/20", icon: "text-ds-amber", label: "text-ds-amber" },
  info:    { bg: "bg-ds-blue/8",  border: "border-ds-blue/20",  icon: "text-ds-blue",  label: "text-ds-blue" },
};

function WarningCard({
  severity,
  icon,
  title,
  count,
  children,
}: {
  severity: "error" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = SEV_STYLES[severity];

  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={[
          "w-full flex items-center gap-2.5 px-4 py-2.5 cursor-pointer",
          "transition-all duration-150 ease-out rounded-t-xl",
          "hover:brightness-95 dark:hover:brightness-110",
          "active:brightness-90 dark:active:brightness-125 active:duration-75",
        ].join(" ")}
      >
        <span className={`shrink-0 ${s.icon}`}>{icon}</span>
        <span className={`text-xs font-semibold ${s.label} flex-1 text-left`}>
          {title}
        </span>
        <span className={`text-[10px] font-mono font-medium ${s.label} bg-white/30 dark:bg-white/10 px-1.5 py-0.5 rounded-full`}>
          {count}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-ds-tertiary transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        >
          <path d="M3.5 1.5L7 5L3.5 8.5" />
        </svg>
      </button>
      {expanded && <div className="px-4 pb-3 pt-0.5">{children}</div>}
    </div>
  );
}

const WARN_ICON = (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 1.5L1 11.5h11L6.5 1.5z" /><path d="M6.5 5v2.5M6.5 9.5v.01" />
  </svg>
);
const ERR_ICON = (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6.5" cy="6.5" r="5" /><path d="M4.5 4.5l4 4M8.5 4.5l-4 4" />
  </svg>
);
const INFO_ICON = (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6.5" cy="6.5" r="5" /><path d="M6.5 5.5v3M6.5 3.5v.01" />
  </svg>
);

/* ----------------------------------------------------------------
   Mini stat tile — used in the always-visible dashboard grid
   ---------------------------------------------------------------- */

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2.5 flex flex-col">
      <span className="text-[10px] uppercase tracking-widest font-semibold text-ds-tertiary">
        {label}
      </span>
      <span className="text-lg font-bold text-ds-primary font-mono leading-tight mt-1">
        {value}
      </span>
      {sub && (
        <span className="text-[10px] text-ds-tertiary mt-0.5">{sub}</span>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
   Category breakdown bar — horizontal stacked bar
   ---------------------------------------------------------------- */

const CAT_COLORS: Record<string, string> = {
  color: "bg-ds-blue",
  typography: "bg-ds-olive",
  spacing: "bg-ds-green",
  sizing: "bg-ds-amber",
  border: "bg-ds-red/70",
  shadow: "bg-ds-tertiary/50",
  opacity: "bg-ds-blue/50",
  "z-index": "bg-ds-amber/50",
  transition: "bg-ds-olive/50",
  other: "bg-border",
};

function CategoryBreakdown({ stats, total }: { stats: TokenCategoryStats[]; total: number }) {
  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
        {stats.map((s) => (
          <div
            key={s.category}
            className={`${CAT_COLORS[s.category] || "bg-border"} transition-all duration-300`}
            style={{ width: `${(s.count / total) * 100}%`, minWidth: s.count > 0 ? 4 : 0 }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      {/* Legend as structured rows */}
      <div className="space-y-1">
        {stats.map((s) => (
          <div key={s.category} className="flex items-center gap-2 text-[11px]">
            <span className={`w-2 h-2 rounded-sm shrink-0 ${CAT_COLORS[s.category] || "bg-border"}`} />
            <span className="text-ds-secondary min-w-[5rem]">{s.label}</span>
            <span className="font-mono text-ds-tertiary">{s.count}</span>
            {s.uniqueValues < s.count && (
              <span className="font-mono text-ds-tertiary/50 text-[10px]">({s.uniqueValues} unique)</span>
            )}
            {s.aliasedCount > 0 && (
              <span className="font-mono text-ds-olive/60 text-[10px] ml-auto">{s.aliasedCount} aliased</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Duplicates list
   ---------------------------------------------------------------- */

function DuplicatesList({ items }: { items: TokenDuplicate[] }) {
  const HEX_MATCH = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  return (
    <div className="grid gap-2">
      {items.slice(0, 12).map((d, i) => {
        const isColor = HEX_MATCH.test(d.value);
        return (
          <div key={i} className="rounded-lg border border-border bg-surface-subtle/50 px-3 py-2">
            {/* Header: value + count */}
            <div className="flex items-center gap-2 mb-1.5">
              {isColor && (
                <span className="w-4 h-4 rounded border border-border shrink-0 shadow-sm" style={{ backgroundColor: d.value }} />
              )}
              <code className="text-[11px] font-mono text-ds-primary font-medium">{d.value}</code>
              <span className="ml-auto text-[10px] font-mono text-ds-tertiary bg-surface-subtle px-1.5 py-0.5 rounded-full">
                ×{d.tokens.length}
              </span>
            </div>
            {/* Token names as pills */}
            <div className="flex flex-wrap gap-1">
              {d.tokens.map((name) => (
                <span key={name} className="text-[10px] font-mono text-ds-secondary bg-surface-subtle px-1.5 py-0.5 rounded">
                  {name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      {items.length > 12 && (
        <p className="text-[10px] text-ds-tertiary text-center py-1">
          +{items.length - 12} more groups
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------
   Detail list renderers for the warning cards
   ---------------------------------------------------------------- */

function NearDuplicatesList({ items }: { items: TokenNearDuplicate[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
          {d.category === "color" && (
            <span className="flex gap-1">
              <span className="w-3.5 h-3.5 rounded border border-border" style={{ backgroundColor: d.value1 }} />
              <span className="w-3.5 h-3.5 rounded border border-border" style={{ backgroundColor: d.value2 }} />
            </span>
          )}
          <span className="text-ds-secondary truncate">{d.token1}</span>
          <span className="text-ds-tertiary">≈</span>
          <span className="text-ds-secondary truncate">{d.token2}</span>
          <span className="text-ds-tertiary ml-auto shrink-0">({d.distance})</span>
        </div>
      ))}
    </div>
  );
}

function ShadowedValuesList({ items }: { items: TokenShadowedValue[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
          {s.category === "color" && (
            <span className="w-3.5 h-3.5 rounded border border-border shrink-0" style={{ backgroundColor: s.resolvedValue }} />
          )}
          <span className="text-ds-secondary truncate">{s.token}</span>
          <span className="text-ds-tertiary truncate">→ {s.resolvedValue}</span>
          <span className="text-ds-amber ml-auto shrink-0">×{s.hardcodedCount} hardcoded</span>
        </div>
      ))}
    </div>
  );
}

function ScalesList({ items }: { items: TokenScaleAnalysis[] }) {
  return (
    <div className="space-y-3">
      {items.map((s, i) => (
        <div key={i}>
          {/* Label left, bar right */}
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex items-center gap-2 shrink-0 min-w-[7rem]">
              <span className="text-[11px] font-semibold text-ds-secondary">{s.label}</span>
              {s.detectedBase && <span className="text-[10px] font-mono text-ds-olive">base-{s.detectedBase}</span>}
              {s.detectedRatio && <span className="text-[10px] font-mono text-ds-olive">{s.detectedRatio}×</span>}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    s.adherence >= 80 ? "bg-ds-green" : s.adherence >= 50 ? "bg-ds-amber" : "bg-ds-red"
                  }`}
                  style={{ width: `${s.adherence}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-ds-tertiary w-8 text-right shrink-0">{s.adherence}%</span>
            </div>
          </div>
          {s.offScale.length > 0 && (
            <div className="flex flex-wrap gap-1 ml-[7rem] pl-3">
              {s.offScale.slice(0, 8).map((name) => (
                <span key={name} className="text-[10px] font-mono text-ds-amber bg-ds-amber/8 px-1.5 py-0.5 rounded">
                  {name}
                </span>
              ))}
              {s.offScale.length > 8 && (
                <span className="text-[10px] font-mono text-ds-tertiary">+{s.offScale.length - 8}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------
   Main insights panel — always visible when tokens exist
   ---------------------------------------------------------------- */

function InsightsPanel({ insights, totalTokens }: { insights: TokenInsights; totalTokens: number }) {
  const {
    categoryStats, duplicates, aliasingRate,
    nearDuplicates, namingIssues, shadowedValues, orphans, scales,
  } = insights;

  const totalDupeTokens = duplicates.reduce((s, d) => s + d.tokens.length, 0);
  const warningCount = nearDuplicates.length + namingIssues.length + shadowedValues.length + orphans.length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-border bg-surface-subtle">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ds-olive">
          Token Analysis
        </p>
      </div>

      <div className="p-4 space-y-5">
        {/* ── Row 1: Key stats ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            label="Categories"
            value={categoryStats.length}
            sub={`of 10 possible`}
          />
          <StatTile
            label="Aliasing"
            value={`${aliasingRate}%`}
            sub={aliasingRate > 50 ? "Well-layered system" : aliasingRate > 0 ? "Some abstraction" : "All raw values"}
          />
          <StatTile
            label="Duplicates"
            value={duplicates.length}
            sub={duplicates.length > 0 ? `${totalDupeTokens} tokens share values` : "All unique"}
          />
        </div>

        {/* ── Row 2: Category breakdown ── */}
        <CategoryBreakdown stats={categoryStats} total={totalTokens} />

        {/* ── Row 3: Per-category ranges ── */}
        {categoryStats.some(s => s.min && s.max) && (
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-ds-tertiary mb-2">
              Value Ranges
            </p>
            <div className="space-y-1">
              {categoryStats.filter(s => s.min && s.max).map(s => (
                <div key={s.category} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-2 h-2 rounded-sm shrink-0 ${CAT_COLORS[s.category] || "bg-border"}`} />
                  <span className="text-ds-secondary min-w-[5rem]">{s.label}</span>
                  <span className="font-mono text-ds-tertiary ml-auto">{s.min}</span>
                  <span className="text-ds-tertiary/40">→</span>
                  <span className="font-mono text-ds-primary">{s.max}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 4: Exact duplicates (always visible if any) ── */}
        {duplicates.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-ds-tertiary mb-2">
              Identical Values
            </p>
            <DuplicatesList items={duplicates} />
          </div>
        )}

        {/* ── Row 5: Warnings (conditional) ── */}
        {(warningCount > 0 || scales.length > 0) && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-ds-tertiary mb-1">
              Findings
              <span className="font-mono ml-1.5 text-ds-tertiary/60">{warningCount + scales.length}</span>
            </p>

            {orphans.length > 0 && (
              <WarningCard severity="error" icon={ERR_ICON} title="Broken references" count={orphans.length}>
                <div className="space-y-1.5">
                  {orphans.map((o, i) => (
                    <div key={i} className="text-[11px] font-mono">
                      <span className="text-ds-secondary">{o.token}</span>
                      <span className="text-ds-tertiary ml-2">{o.reason}</span>
                    </div>
                  ))}
                </div>
              </WarningCard>
            )}

            {nearDuplicates.length > 0 && (
              <WarningCard severity="warning" icon={WARN_ICON} title="Near-duplicate values" count={nearDuplicates.length}>
                <NearDuplicatesList items={nearDuplicates} />
              </WarningCard>
            )}

            {shadowedValues.length > 0 && (
              <WarningCard severity="warning" icon={WARN_ICON} title="Hardcoded values bypass tokens" count={shadowedValues.length}>
                <ShadowedValuesList items={shadowedValues} />
              </WarningCard>
            )}

            {namingIssues.length > 0 && (
              <WarningCard severity="info" icon={INFO_ICON} title="Naming inconsistencies" count={namingIssues.length}>
                <div className="space-y-1.5">
                  {namingIssues.map((n, i) => (
                    <div key={i} className="text-[11px] font-mono">
                      <span className="text-ds-secondary">{n.token}</span>
                      <span className="text-ds-tertiary ml-2">
                        uses <span className="text-ds-amber">{n.actual}-*</span> — convention is <span className="text-ds-olive">{n.expected}-*</span>
                      </span>
                    </div>
                  ))}
                </div>
              </WarningCard>
            )}

            {scales.length > 0 && (
              <WarningCard severity="info" icon={INFO_ICON} title="Scale & system detection" count={scales.length}>
                <ScalesList items={scales} />
              </WarningCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Main component
   ---------------------------------------------------------------- */

interface Props {
  data: DesignTokensResult;
  filterQuery?: string;
}

/** Counts how many tokens match the given query (exported for parent badge). */
export function countTokenMatches(data: DesignTokensResult, rawQuery: string): number {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return 0;
  if ("design tokens".includes(q)) return data.totalCount;
  return data.groups.reduce(
    (sum, g) =>
      sum +
      g.tokens.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.value.toLowerCase().includes(q) ||
          (t.rawValue && t.rawValue.toLowerCase().includes(q))
      ).length,
    0
  );
}

export default function DesignTokensView({ data, filterQuery }: Props) {
  /* Active category filters — empty set means "show all" */
  const [activeCategories, setActiveCategories] = useState<Set<TokenCategory>>(new Set());

  const isEmpty = data.totalCount === 0;
  const allActive = activeCategories.size === 0;

  const toggleCategory = (cat: TokenCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  /* Filter groups by active category toggles + external search query */
  let filteredGroups: TokenGroup[] = allActive
    ? data.groups
    : data.groups.filter((g) => activeCategories.has(g.category));

  const query = (filterQuery || "").toLowerCase().trim();
  if (query) {
    filteredGroups = filteredGroups
      .map((g) => ({
        ...g,
        tokens: g.tokens.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.value.toLowerCase().includes(query) ||
            (t.rawValue && t.rawValue.toLowerCase().includes(query))
        ),
      }))
      .filter((g) => g.tokens.length > 0);
  }

  /* When search is active and nothing in this section matches, hide entirely */
  if (query && !isEmpty && filteredGroups.length === 0) return null;

  return (
    <div className="space-y-4">
      {isEmpty ? (
        <EmptyTokens />
      ) : (
        <>
          {/* Category filter pills — click to toggle visibility */}
          <div className="flex flex-wrap gap-1.5">
            {data.groups.map((g) => {
              const isOn = allActive || activeCategories.has(g.category);
              return (
                <button
                  key={g.category}
                  onClick={() => toggleCategory(g.category)}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full cursor-pointer transition-all duration-200 border ${
                    isOn
                      ? "bg-ds-olive/10 border-ds-olive/30 text-ds-primary"
                      : "bg-surface-subtle border-border text-ds-tertiary opacity-50"
                  }`}
                >
                  <span className={isOn ? "text-ds-olive" : "text-ds-tertiary"}>
                    {CATEGORY_ICONS[g.category]}
                  </span>
                  {g.label}
                  <span className="font-mono">{g.tokens.length}</span>
                </button>
              );
            })}

            {!allActive && (
              <button
                onClick={() => setActiveCategories(new Set())}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-ds-tertiary hover:text-ds-secondary px-2 py-1 rounded-full cursor-pointer transition-colors duration-150"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M2 2l6 6M8 2l-6 6" />
                </svg>
                Clear
              </button>
            )}
          </div>

          {/* Insights panel — always visible when tokens exist */}
          {!query && <InsightsPanel insights={data.insights} totalTokens={data.totalCount} />}

          {/* Category groups */}
          {filteredGroups.length === 0 ? (
            <p className="text-sm text-ds-tertiary text-center py-6">
              No categories selected
            </p>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((g) => (
                <CategoryGroup key={g.category} group={g} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
