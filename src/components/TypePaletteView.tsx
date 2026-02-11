"use client";

import { useState, useEffect } from "react";
import { TextStyle } from "@/lib/audit/types";

interface Props {
  styles: TextStyle[];
  fontFaces?: string[];
}

function SelectorTooltip({ elements }: { elements: string[] }) {
  const [copied, setCopied] = useState(false);
  if (elements.length === 0) return null;

  const copyAll = () => {
    navigator.clipboard.writeText(elements.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="absolute left-0 bottom-full pb-1.5 z-50 select-text cursor-text">
    <div className="bg-bg-card border border-border rounded-lg px-3 py-2.5 shadow-lg max-w-sm">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-ds-tertiary uppercase tracking-wider">
          Applied to
        </p>
        <button
          onClick={copyAll}
          className="flex items-center gap-1 text-[10px] text-ds-tertiary hover:text-ds-primary transition-colors cursor-pointer bg-transparent border-none p-0"
          title="Copy all selectors"
        >
          {copied ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ds-green"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {elements.map((el, i) => (
        <p
          key={i}
          className="text-xs font-mono text-ds-secondary truncate leading-relaxed"
        >
          {el}
        </p>
      ))}
    </div>
    </div>
  );
}

export default function TypePaletteView({ styles, fontFaces }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!fontFaces || fontFaces.length === 0) return;
    const id = "designlens-audit-fonts";
    document.getElementById(id)?.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = fontFaces.join("\n");
    document.head.appendChild(style);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [fontFaces]);

  if (styles.length === 0) return null;

  return (
    <div className="border-t border-border pt-5 pb-6">
      {/* Lighter header — this is always-visible content, not an accordion */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ds-tertiary font-medium">Type Palette</p>
        <span className="text-xs text-ds-tertiary font-mono">
          {styles.length} styles
        </span>
      </div>

      <div className="space-y-1">
        {styles.map((s, i) => {
          const px = parseFloat(s.fontSize) || 14;
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={i}
              className={`flex items-baseline gap-4 py-2.5 -mx-3 px-3 rounded-lg transition-colors relative ${
                isHovered ? "bg-ds-olive-50" : ""
              }`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div
                className="flex-1 min-w-0 truncate text-ds-primary"
                style={{
                  fontSize: `${Math.min(px, 48)}px`,
                  fontWeight: s.fontWeight,
                  fontFamily: `${s.fontFamily}, system-ui, sans-serif`,
                  lineHeight: s.lineHeight,
                  letterSpacing:
                    s.letterSpacing !== "normal" ? s.letterSpacing : undefined,
                }}
              >
                {px >= 20
                  ? "The quick brown fox"
                  : "The quick brown fox jumps over the lazy dog"}
              </div>

              <div className="shrink-0 text-right space-y-0.5">
                <p className="text-xs font-mono text-ds-secondary">
                  {s.fontSize}{" "}
                  <span className="text-ds-tertiary">/ {s.fontWeight}</span>
                </p>
                <p className="text-xs font-mono text-ds-tertiary truncate max-w-[140px]">
                  {s.fontFamily}
                </p>
                <p className="text-xs text-ds-tertiary">×{s.count}</p>
              </div>

              {isHovered && <SelectorTooltip elements={s.elements} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
