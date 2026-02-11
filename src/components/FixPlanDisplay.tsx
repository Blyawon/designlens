"use client";

import { FixAction } from "@/lib/audit/types";

interface Props {
  actions: FixAction[];
}

const severityStyle: Record<string, string> = {
  high: "bg-[var(--grade-red-bg)] text-ds-red border-[var(--grade-red-border)]",
  medium: "bg-[var(--grade-amber-bg)] text-ds-amber border-[var(--grade-amber-border)]",
  low: "bg-[var(--grade-blue-bg)] text-ds-blue border-[var(--grade-blue-border)]",
};

const severityDot: Record<string, string> = {
  high: "bg-ds-red",
  medium: "bg-ds-amber",
  low: "bg-ds-blue",
};

export default function FixPlanDisplay({ actions }: Props) {
  if (actions.length === 0) return null;

  return (
    <div>
      <h3 className="text-base font-semibold text-ds-primary mb-4">
        Findings
      </h3>
      <div className="space-y-3">
        {actions.map((a, i) => (
          <div key={i} className="flex gap-2 sm:gap-3">
            <div className="flex flex-col items-center pt-1.5 shrink-0">
              <div
                className={`w-2 h-2 rounded-full ${severityDot[a.severity]}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-medium text-ds-primary">
                  {a.title}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-md border ${severityStyle[a.severity]}`}
                >
                  {a.severity}
                </span>
                <span className="text-xs text-ds-tertiary">{a.category}</span>
              </div>
              <p className="text-xs text-ds-tertiary mt-0.5">
                {a.description}
              </p>
              {a.items.length > 0 && (
                <p className="text-xs font-mono text-ds-secondary mt-1 break-words overflow-hidden">
                  {a.items.slice(0, 6).join(" · ")}
                  {a.items.length > 6 && <span className="text-ds-tertiary"> +{a.items.length - 6} more</span>}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
