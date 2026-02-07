"use client";

import { useState, useRef, useEffect } from "react";
import { ScreenshotAnnotation } from "@/lib/audit/types";

interface Props {
  screenshotId: string;
  annotations: ScreenshotAnnotation[];
  viewportWidth: number;
  pageHeight: number;
}

export default function ScreenshotView({
  screenshotId,
  annotations,
  viewportWidth,
  pageHeight,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "spacing" | "patterns">("all");

  useEffect(() => {
    function updateScale() {
      if (containerRef.current) {
        setScale(containerRef.current.offsetWidth / viewportWidth);
      }
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [viewportWidth]);

  const filtered = annotations.filter((a) => {
    if (filter === "all") return true;
    if (filter === "spacing") return a.issue.startsWith("Off-grid");
    if (filter === "patterns") return a.issue.startsWith("Pattern:");
    return true;
  });

  // Limit visible height to avoid huge container
  const maxDisplayHeight = Math.min(pageHeight * scale, 800);

  return (
    <div className="border-t border-border pt-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-ds-primary">
          Annotated Screenshot
        </h3>
        <div className="flex gap-1 text-[11px]">
          {(["all", "spacing", "patterns"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                filter === f
                  ? "bg-white/10 text-ds-primary"
                  : "text-ds-tertiary hover:text-ds-secondary"
              }`}
            >
              {f === "all" ? "All" : f === "spacing" ? "Off-grid" : "Patterns"}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden border border-border bg-bg-card"
        style={{ maxHeight: maxDisplayHeight }}
      >
        {/* screenshot image */}
        <img
          src={`/api/screenshot/${screenshotId}`}
          alt="Page screenshot"
          className="w-full block"
          style={{ imageRendering: "auto" }}
        />

        {/* annotation overlays */}
        {filtered.map((a, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={i}
              className="absolute transition-opacity"
              style={{
                top: a.boundingBox.top * scale,
                left: a.boundingBox.left * scale,
                width: Math.max(a.boundingBox.width * scale, 4),
                height: Math.max(a.boundingBox.height * scale, 4),
                border: `2px solid ${a.color}`,
                backgroundColor: isHovered ? a.color : "transparent",
                opacity: isHovered ? 0.3 : 0.7,
                zIndex: isHovered ? 50 : 1,
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {isHovered && (
                <div className="absolute bottom-full left-0 mb-1 z-50 bg-[#141414] border border-border-light rounded-md px-2 py-1 text-[10px] font-mono text-ds-secondary shadow-lg whitespace-nowrap pointer-events-none">
                  {a.issue}
                  <br />
                  <span className="text-ds-tertiary">{a.selector}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-ds-tertiary mt-2">
        {filtered.length} annotations · hover to inspect ·{" "}
        {annotations.filter((a) => a.issue.startsWith("Off-grid")).length} off-grid ·{" "}
        {annotations.filter((a) => a.issue.startsWith("Pattern:")).length} pattern matches
      </p>
    </div>
  );
}
