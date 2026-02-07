"use client";

import { ColorSprawlResult, CategoryScore } from "@/lib/audit/types";
import { useState } from "react";

interface Props {
  data: ColorSprawlResult;
  score?: CategoryScore;
  defaultOpen?: boolean;
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
          className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ds-primary text-white text-xs font-mono shadow-lg"
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

export default function ColorPalette({ data, score, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border-t border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between py-4 sm:py-5 text-left cursor-pointer group"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-ds-primary">
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
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="text-xs text-ds-tertiary font-mono">
            {data.uniqueCount}
            <span className="hidden sm:inline">
              {data.nearDuplicates.length > 0 &&
                ` · ${data.nearDuplicates.length} dupes`}
            </span>
          </span>
          <span className="text-sm text-ds-tertiary group-hover:text-ds-secondary transition-colors">
            {open ? "−" : "+"}
          </span>
        </div>
      </button>

      {open && (
        <div
          className="pb-5 sm:pb-6 space-y-4 sm:space-y-5"
          style={{ animation: "slideDown 0.25s ease-out" }}
        >
          {score?.signals && score.signals.length > 0 && (
            <div className="space-y-2 sm:space-y-2.5 pb-2">
              {score.signals.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-2 sm:gap-3 text-xs"
                >
                  <span className="w-20 sm:w-28 text-ds-tertiary truncate shrink-0">
                    {s.name}
                  </span>
                  <div className="w-20 sm:w-28 h-2 bg-black/[0.06] rounded-full overflow-hidden shrink-0">
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
            {data.hueGroups.map((group) => (
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

          {data.nearDuplicates.length > 0 && (
            <div>
              <p className="text-xs text-ds-amber font-medium mb-3">
                Near-duplicates (ΔE &lt; 5)
              </p>
              <div className="space-y-2">
                {data.nearDuplicates.slice(0, 8).map((d, i) => (
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
      )}
    </div>
  );
}
