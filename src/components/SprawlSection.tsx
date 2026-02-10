"use client";

import { useState } from "react";
import { TypeValue, CategoryScore, ScoreSignal } from "@/lib/audit/types";

/* ---- Hover tooltip (hidden on mobile) ---- */

function SelectorTooltip({ elements }: { elements: string[] }) {
  if (elements.length === 0) return null;
  return (
    <div className="hidden sm:block absolute left-24 bottom-full mb-1.5 z-50 bg-bg-card border border-border rounded-lg px-3 py-2.5 shadow-lg max-w-sm pointer-events-none">
      <p className="text-xs text-ds-tertiary mb-1.5 uppercase tracking-wider">
        Applied to
      </p>
      {elements.map((el, i) => (
        <p
          key={i}
          className="text-xs font-mono text-ds-secondary truncate leading-relaxed"
        >
          {el}
        </p>
      ))}
    </div>
  );
}

/* ---- Distribution bar with grow animation ---- */

function Bar({
  item,
  maxCount,
  warning,
  index,
}: {
  item: TypeValue;
  maxCount: number;
  warning?: boolean;
  index: number;
}) {
  const [hover, setHover] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const pct = Math.max(3, Math.round((item.count / maxCount) * 100));
  const barColor = warning ? "bg-amber-200" : "bg-ds-olive-100";

  const copyValue = () => {
    navigator.clipboard.writeText(item.value);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1200);
  };

  return (
    <div
      className="flex items-center gap-2 sm:gap-3 h-7 sm:h-8 text-xs sm:text-sm font-mono relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={copyValue}
        title="Click to copy"
        className={`w-14 sm:w-20 text-right tabular-nums truncate shrink-0 transition-colors cursor-pointer bg-transparent border-none p-0 font-mono text-xs sm:text-sm ${
          justCopied
            ? "text-ds-green font-medium"
            : hover
              ? "text-ds-primary font-medium"
              : "text-ds-secondary"
        }`}
      >
        {justCopied ? "Copied" : item.value}
      </button>
      <div className="flex-1 h-4 sm:h-5 bg-[var(--surface-tint)] rounded-sm relative overflow-hidden">
        <div
          className={`h-full rounded-sm ${barColor}`}
          style={{
            width: `${pct}%`,
            transformOrigin: "left",
            animation: `growBar 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 0.025}s both`,
          }}
        />
      </div>
      <span className="w-6 sm:w-8 text-right text-ds-tertiary tabular-nums shrink-0 text-xs">
        {item.count}
      </span>
      {warning && (
        <span className="w-4 text-ds-amber text-xs shrink-0 font-bold">!</span>
      )}
      {!warning && <span className="w-4 shrink-0" />}

      {hover && <SelectorTooltip elements={item.elements} />}
    </div>
  );
}

/* ---- Signal bar ---- */

function SignalRow({ signal }: { signal: ScoreSignal }) {
  const pct = Math.max(0, Math.min(100, signal.value));
  const color =
    pct >= 80
      ? "bg-ds-green"
      : pct >= 55
        ? "bg-ds-amber"
        : "bg-ds-red";
  return (
    <div className="flex items-center gap-2 sm:gap-3 text-xs">
      <span className="w-20 sm:w-28 text-ds-tertiary truncate shrink-0">
        {signal.name}
      </span>
      <div className="w-20 sm:w-28 h-2 bg-[var(--surface-overlay)] rounded-full overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full ${color}`}
          style={{
            width: `${pct}%`,
            transformOrigin: "left",
            animation: "growBar 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both",
          }}
        />
      </div>
      <span className="text-ds-secondary truncate">{signal.label}</span>
    </div>
  );
}

/* ---- Main section ---- */

interface Props {
  title: string;
  score?: CategoryScore;
  values: TypeValue[];
  flagged?: Set<string>;
  sortable?: boolean;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}

const gradeColor: Record<string, string> = {
  A: "text-ds-green",
  B: "text-ds-blue",
  C: "text-ds-amber",
  D: "text-ds-red",
  F: "text-ds-red",
};

export default function SprawlSection({
  title,
  score,
  values,
  flagged,
  sortable,
  defaultOpen,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [sortBy, setSortBy] = useState<"frequency" | "value">("frequency");

  const sortedValues =
    sortBy === "value"
      ? [...values].sort((a, b) => {
          const pxA = parseFloat(a.value) || 0;
          const pxB = parseFloat(b.value) || 0;
          return pxA - pxB;
        })
      : values;

  const maxCount =
    sortedValues.length > 0
      ? Math.max(...sortedValues.map((v) => v.count))
      : 1;

  return (
    <div className="border-t border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between py-4 sm:py-5 text-left cursor-pointer group"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-ds-primary truncate">
            {title}
          </h3>
          {score && (
            <span
              className={`text-sm sm:text-base font-bold font-mono shrink-0 ${gradeColor[score.grade]}`}
            >
              {score.grade}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="text-xs text-ds-tertiary font-mono">
            {values.length}
          </span>
          <span className="text-sm text-ds-tertiary group-hover:text-ds-secondary transition-colors">
            {open ? "−" : "+"}
          </span>
        </div>
      </button>

      {open && (
        <div
          className="pb-5 sm:pb-6 space-y-3 sm:space-y-4"
          style={{ animation: "slideDown 0.25s ease-out" }}
        >
          {score?.signals && score.signals.length > 0 && (
            <div className="space-y-2 sm:space-y-2.5 pb-3 sm:pb-4">
              {score.signals.map((s) => (
                <SignalRow key={s.name} signal={s} />
              ))}
            </div>
          )}

          {sortable && (
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setSortBy("frequency")}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  sortBy === "frequency"
                    ? "bg-ds-olive-100 text-ds-primary font-medium"
                    : "text-ds-tertiary hover:text-ds-secondary"
                }`}
              >
                By frequency
              </button>
              <button
                onClick={() => setSortBy("value")}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  sortBy === "value"
                    ? "bg-ds-olive-100 text-ds-primary font-medium"
                    : "text-ds-tertiary hover:text-ds-secondary"
                }`}
              >
                By value
              </button>
            </div>
          )}

          <div className="space-y-0.5">
            {sortedValues.slice(0, 30).map((v, i) => (
              <Bar
                key={v.value}
                item={v}
                maxCount={maxCount}
                warning={flagged?.has(v.value)}
                index={i}
              />
            ))}
            {sortedValues.length > 30 && (
              <p className="text-xs text-ds-tertiary pt-1">
                +{sortedValues.length - 30} more
              </p>
            )}
          </div>

          {children}
        </div>
      )}
    </div>
  );
}
