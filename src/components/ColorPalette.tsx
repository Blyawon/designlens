"use client";

import { ColorSprawlResult, CategoryScore } from "@/lib/audit/types";
import { useState } from "react";

interface Props {
  data: ColorSprawlResult;
  score?: CategoryScore;
  defaultOpen?: boolean; // kept for API compat, ignored
  filterQuery?: string;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function HueStrip({
  colors,
}: {
  colors: { hex: string; count: number; name: string }[];
}) {
  const [hovered, setHovered] = useState<{
    hex: string;
    count: number;
    name: string;
  } | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const sorted = [...colors].sort(
    (a, b) => luminance(b.hex) - luminance(a.hex)
  );

  const copyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1400);
  };

  return (
    <div className="space-y-1.5 relative">
      {/* Floating toast */}
      {copiedHex && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ds-primary text-bg-card text-xs font-mono shadow-lg"
          style={{ animation: "slideDown 0.15s ease-out" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copied {copiedHex}
        </div>
      )}
      <div className="flex h-7 sm:h-8 rounded-lg overflow-hidden border border-black/[0.06]">
        {sorted.map((c, i) => (
          <div
            key={`${c.hex}-${i}`}
            className={`h-full cursor-pointer transition-opacity duration-150 ${
              hovered && hovered.hex !== c.hex ? "opacity-40" : ""
            }`}
            style={{
              backgroundColor: c.hex,
              flex: `${Math.max(c.count, 1)} 0 0%`,
              minWidth: "6px",
            }}
            onMouseEnter={() => setHovered(c)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => copyHex(c.hex)}
          />
        ))}
      </div>
      <div className="h-4">
        {hovered && (
          <div className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-sm border border-black/10 shrink-0"
              style={{ backgroundColor: hovered.hex }}
            />
            <span className="font-mono text-ds-secondary">{hovered.hex}</span>
            <span className="text-ds-tertiary hidden sm:inline">
              {hovered.name}
            </span>
            <span className="text-ds-tertiary">×{hovered.count}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const gradeColor: Record<string, string> = {
  A: "text-ds-green",
  B: "text-ds-blue",
  C: "text-ds-amber",
  D: "text-ds-red",
  F: "text-ds-red",
};

export default function ColorPalette({ data, score, filterQuery }: Props) {
  /* Apply global search filter.
     If query matches "colors" or a hue group name, show everything. */
  const query = (filterQuery || "").toLowerCase().trim();
  const titleMatch = query && "colors".includes(query);

  const filteredGroups = query && !titleMatch
    ? data.hueGroups
        .map((group) => ({
          ...group,
          colors: group.colors.filter(
            (c) =>
              c.hex.toLowerCase().includes(query) ||
              c.name.toLowerCase().includes(query) ||
              group.name.toLowerCase().includes(query)
          ),
        }))
        .filter((g) => g.colors.length > 0)
    : data.hueGroups;

  const filteredDupes = query && !titleMatch
    ? data.nearDuplicates.filter(
        (d) =>
          d.color1.toLowerCase().includes(query) ||
          d.color2.toLowerCase().includes(query)
      )
    : data.nearDuplicates;

  /* Hide entirely when search is active but nothing matches */
  if (query && !titleMatch && filteredGroups.length === 0 && filteredDupes.length === 0) return null;

  return (
    <div className="border-t border-border">
      {/* Static header — L2 (subordinate to SectionGroup L1) */}
      <div className="flex items-center justify-between py-3 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h3 className="text-xs sm:text-sm font-semibold text-ds-secondary">
            Colors
          </h3>
          {score && (
            <span
              className={`text-sm sm:text-base font-bold font-mono ${gradeColor[score.grade]}`}
            >
              {score.grade}
            </span>
          )}
        </div>
        <span className="text-xs text-ds-tertiary font-mono shrink-0">
          {data.uniqueCount}
          <span className="hidden sm:inline">
            {data.nearDuplicates.length > 0 &&
              ` · ${data.nearDuplicates.length} dupes`}
          </span>
        </span>
      </div>

      {/* Content — always visible */}
      <div className="pb-5 sm:pb-6 space-y-4 sm:space-y-5">
        {score?.signals && score.signals.length > 0 && !query && (
          <div className="space-y-2 sm:space-y-2.5 pb-2">
            {score.signals.map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-1.5 sm:gap-3 text-xs"
              >
                <span className="w-16 sm:w-28 text-ds-tertiary truncate shrink-0 text-[10px] sm:text-xs">
                  {s.name}
                </span>
                <div className="w-16 sm:w-28 h-2 bg-[var(--surface-overlay)] rounded-full overflow-hidden shrink-0">
                  <div
                    className={`h-full rounded-full ${
                      s.value >= 80
                        ? "bg-ds-green"
                        : s.value >= 55
                          ? "bg-ds-amber"
                          : "bg-ds-red"
                    }`}
                    style={{ width: `${s.value}%` }}
                  />
                </div>
                <span className="text-ds-secondary truncate">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <div key={group.name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ds-secondary font-medium">
                  {group.name}
                </span>
                <span className="text-xs text-ds-tertiary font-mono">
                  {group.colors.length}
                </span>
              </div>
              <HueStrip colors={group.colors.slice(0, 30)} />
            </div>
          ))}
        </div>

        {filteredDupes.length > 0 && (
          <div>
            <p className="text-xs text-ds-amber font-medium mb-3">
              Near-duplicates (ΔE &lt; 5)
            </p>
            <div className="space-y-2">
              {filteredDupes.slice(0, 8).map((d, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 sm:gap-2.5 text-xs font-mono text-ds-secondary flex-wrap sm:flex-nowrap"
                >
                  <div className="flex h-5 sm:h-6 w-10 sm:w-12 rounded overflow-hidden border border-black/[0.06] shrink-0">
                    <div
                      className="h-full flex-1"
                      style={{ backgroundColor: d.color1 }}
                    />
                    <div
                      className="h-full flex-1"
                      style={{ backgroundColor: d.color2 }}
                    />
                  </div>
                  <span className="truncate cursor-pointer hover:text-ds-primary transition-colors" onClick={() => navigator.clipboard.writeText(d.color1)}>{d.color1}</span>
                  <span className="text-ds-tertiary">≈</span>
                  <span className="truncate cursor-pointer hover:text-ds-primary transition-colors" onClick={() => navigator.clipboard.writeText(d.color2)}>{d.color2}</span>
                  <span className="text-ds-amber ml-auto shrink-0">
                    ΔE {d.distance}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
