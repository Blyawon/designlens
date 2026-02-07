"use client";

import { TypeScaleAnalysis } from "@/lib/audit/types";

interface Props {
  data: TypeScaleAnalysis;
}

export default function TypeScaleView({ data }: Props) {
  if (!data.baseSize || data.steps.length === 0) return null;

  const maxPx = Math.max(...data.steps.map((s) => s.px));

  return (
    <div className="border-t border-border pt-5 pb-6">
      {/* Lighter header — always-visible content */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-ds-tertiary font-medium">Type Scale</p>
        <div className="flex items-center gap-2 text-xs">
          {data.scaleName ? (
            <span className="text-ds-green font-mono font-medium">
              {data.scaleName} ({data.detectedRatio})
            </span>
          ) : data.detectedRatio ? (
            <span className="text-ds-amber font-mono">
              ~{data.detectedRatio} (no standard match)
            </span>
          ) : (
            <span className="text-ds-tertiary">No scale detected</span>
          )}
          <span className="text-ds-tertiary">·</span>
          <span className="text-ds-tertiary font-mono">
            base {data.baseSize}px
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {data.steps.map((step) => {
          const widthPct = Math.max(8, Math.round((step.px / maxPx) * 100));
          return (
            <div key={step.px} className="flex items-center gap-3">
              <span
                className={`w-10 text-right text-xs font-mono shrink-0 ${
                  step.fits ? "text-ds-tertiary" : "text-ds-amber font-medium"
                }`}
              >
                {step.label}
              </span>

              <div className="flex-1 relative">
                <div
                  className={`h-7 rounded-sm flex items-center px-2 transition-all ${
                    step.fits
                      ? "bg-ds-olive-100"
                      : "bg-amber-50 border border-amber-200"
                  }`}
                  style={{ width: `${widthPct}%` }}
                >
                  <span
                    className="text-ds-secondary font-mono truncate"
                    style={{ fontSize: `${Math.min(step.px, 20)}px` }}
                  >
                    {step.px}px
                  </span>
                </div>
              </div>

              <span className="w-10 text-right text-xs text-ds-tertiary font-mono shrink-0">
                ×{step.usage}
              </span>

              <span className="w-4 shrink-0 text-xs">
                {step.fits ? (
                  <span className="text-ds-green font-bold">✓</span>
                ) : (
                  <span className="text-ds-amber font-bold">✗</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {data.outliers.length > 0 && (
        <p className="text-xs text-ds-amber mt-3">
          {data.outliers.length} size{data.outliers.length > 1 ? "s" : ""}{" "}
          don&apos;t fit the scale:{" "}
          {data.outliers.map((o) => `${o}px`).join(", ")}
        </p>
      )}
    </div>
  );
}
