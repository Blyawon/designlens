"use client";

import { AuditResult } from "@/lib/audit/types";
import ScoreRing from "@/components/ScoreRing";
import { useState } from "react";

interface Props {
  report: AuditResult;
}

const gradeColor: Record<string, string> = {
  A: "text-ds-green",
  B: "text-ds-blue",
  C: "text-ds-amber",
  D: "text-ds-red",
  F: "text-ds-red",
};

export default function ReportCard({ report }: Props) {
  const [copied, setCopied] = useState(false);
  const r = report;

  function share() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="border border-border rounded-2xl overflow-hidden bg-bg-card shadow-sm">
          {/* header */}
          <div className="px-6 pt-6 pb-3 text-center border-b border-border">
            <h1 className="text-lg font-serif text-ds-primary">
              Designlens
            </h1>
            <p className="text-xs text-ds-tertiary mt-1 font-mono truncate">
              {r.url}
            </p>
            <p className="text-xs text-ds-tertiary mt-0.5">
              {new Date(r.timestamp).toLocaleDateString()} · {r.elementCount}{" "}
              elements
            </p>
          </div>

          {/* score */}
          <div className="px-6 py-8 flex flex-col items-center">
            <ScoreRing
              score={r.scores.overall}
              grade={r.scores.grade}
              label="Design Consistency"
            />
          </div>

          {/* categories */}
          <div className="px-6 pb-5">
            <div className="flex flex-wrap gap-2 justify-center">
              {r.scores.categories.slice(0, 9).map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ds-olive-50 border border-ds-olive-100/60"
                >
                  <span className="text-xs text-ds-secondary">{c.name}</span>
                  <span
                    className={`text-xs font-bold font-mono ${gradeColor[c.grade]}`}
                  >
                    {c.grade}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* key stats */}
          <div className="px-6 pb-5 flex justify-center gap-6 text-center">
            {[
              { n: r.colorSprawl.uniqueCount, l: "Colours" },
              { n: r.typeSprawl.fontSizes.length, l: "Sizes" },
              { n: r.spacingSprawl.allValues.length, l: "Spacing" },
              { n: r.spacingSprawl.offGrid.length, l: "Off-grid" },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-lg font-bold font-mono text-ds-primary">
                  {s.n}
                </p>
                <p className="text-xs text-ds-tertiary">{s.l}</p>
              </div>
            ))}
          </div>

          {/* hue groups */}
          <div className="px-6 pb-5">
            <p className="text-xs text-ds-tertiary mb-1.5 uppercase tracking-wider">
              Palette
            </p>
            <div className="space-y-1">
              {(r.colorSprawl.hueGroups ?? []).slice(0, 4).map((g) => (
                <div key={g.name} className="flex items-center gap-2">
                  <span className="text-xs text-ds-tertiary w-14 text-right">
                    {g.name}
                  </span>
                  <div className="flex gap-0.5">
                    {g.colors.slice(0, 12).map((c) => (
                      <div
                        key={c.hex}
                        className="w-4 h-4 rounded border border-black/10"
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* findings summary */}
          {r.fixPlan.length > 0 && (
            <div className="px-6 pb-5">
              <p className="text-xs text-ds-tertiary mb-1.5 uppercase tracking-wider">
                Top findings ({r.fixPlan.length})
              </p>
              <div className="space-y-1">
                {r.fixPlan.slice(0, 3).map((f, i) => (
                  <div
                    key={i}
                    className="text-xs text-ds-secondary flex items-center gap-2"
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        f.severity === "high"
                          ? "bg-ds-red"
                          : f.severity === "medium"
                            ? "bg-ds-amber"
                            : "bg-ds-blue"
                      }`}
                    />
                    <span>{f.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <a
              href="/"
              className="text-xs text-ds-secondary hover:text-ds-primary transition-colors"
            >
              Run your own audit →
            </a>
            <button
              onClick={share}
              className="h-8 px-4 text-xs font-medium rounded-lg bg-ds-olive text-white hover:bg-ds-olive/90 cursor-pointer transition-colors"
            >
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
