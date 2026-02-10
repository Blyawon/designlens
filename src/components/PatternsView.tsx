"use client";

import { useState } from "react";
import { PatternAnalysis } from "@/lib/audit/types";

interface Props {
  data: PatternAnalysis;
}

export default function PatternsView({ data }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="border-t border-border pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-ds-primary">
          Component Patterns
        </h3>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-ds-green font-mono">{data.coverage}%</span>
          <span className="text-ds-tertiary">coverage</span>
          <span className="text-ds-tertiary">·</span>
          <span className="text-ds-tertiary font-mono">
            {data.patterns.length} patterns
          </span>
          <span className="text-ds-tertiary">·</span>
          <span className="text-ds-tertiary font-mono">
            {data.oneOffs} one-offs
          </span>
        </div>
      </div>

      {/* Coverage bar */}
      <div className="mb-4">
        <div className="h-2 bg-surface-subtle rounded-full overflow-hidden flex">
          {data.patterns.slice(0, 8).map((p, i) => (
            <div
              key={i}
              className="h-full transition-all"
              style={{
                width: `${(p.count / data.totalElements) * 100}%`,
                backgroundColor: p.color,
                opacity: 0.6,
              }}
              title={`${p.name}: ${p.count} elements`}
            />
          ))}
          {data.oneOffs > 0 && (
            <div
              className="h-full bg-ds-olive/10"
              style={{
                width: `${(data.oneOffs / data.totalElements) * 100}%`,
              }}
              title={`One-offs: ${data.oneOffs} elements`}
            />
          )}
        </div>
      </div>

      {/* Pattern list */}
      <div className="space-y-1">
        {data.patterns.slice(0, 10).map((p, i) => (
          <div key={i}>
            <button
              className="w-full flex items-center gap-3 py-1.5 text-left cursor-pointer group"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              {/* color dot */}
              <div
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: p.color }}
              />
              {/* name */}
              <span className="text-[13px] text-ds-primary flex-1">
                {p.name}
              </span>
              {/* count */}
              <span className="text-[11px] text-ds-tertiary font-mono">
                {p.count} elements
              </span>
              {/* tags */}
              <span className="text-[10px] text-ds-tertiary font-mono">
                &lt;{p.tags.slice(0, 2).join(", ")}&gt;
              </span>
            </button>

            {expanded === i && (
              <div className="ml-6 mb-2 space-y-1">
                {/* Properties */}
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {Object.entries(p.properties).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle text-ds-secondary border border-border"
                    >
                      {k}: {v}
                    </span>
                  ))}
                </div>
                {/* Element selectors */}
                {p.elements.slice(0, 4).map((sel, j) => (
                  <p
                    key={j}
                    className="text-[10px] font-mono text-ds-tertiary truncate"
                  >
                    {sel}
                  </p>
                ))}
                {p.elements.length > 4 && (
                  <p className="text-[10px] text-ds-tertiary">
                    +{p.elements.length - 4} more
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
