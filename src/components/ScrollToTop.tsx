"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-to-top FAB with radial scroll-progress ring.
 *
 * Design parity:
 *   Visual style mirrors ThemeToggle (40px circle, border/bg/blur/shadow).
 *   Pressed state mirrors the dock chip (active:scale-[0.97], 75ms in / 200ms out).
 *   Positioned bottom-right, right edge aligned with ThemeToggle.
 *
 * Performance:
 *   Scroll-driven values (ring offset, visibility) are written directly
 *   to the DOM via refs — zero React re-renders in the scroll handler.
 *   Only the initial mount triggers a render.
 *
 * Micro-interactions:
 *   - Show/hide: opacity + translateY(10px) on a wrapper div (300ms ease).
 *   - Progress ring: CSS transition on stroke-dashoffset (150ms ease-out).
 *   - Press: scale(0.97) over 75ms, release springs back over 200ms (dock chip pattern).
 *   - Hover: chevron lifts 2px — directional hint.
 */
export default function ScrollToTop() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);

  /* ── Ring geometry (constant) ───────────────────────────────── */
  const size = 40;
  const sw = 2; // stroke width
  const r = (size - sw) / 2;
  const C = 2 * Math.PI * r; // circumference ≈ 119.38

  /* ── Scroll tracking — direct DOM, no re-renders ───────────── */
  useEffect(() => {
    let ticking = false;
    let wasVisible = false;

    const update = () => {
      const y = window.scrollY;
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(y / max, 1) : 0;
      const show = y > 300;

      /* Wrapper: fade + slide */
      const wrap = wrapRef.current;
      if (wrap && show !== wasVisible) {
        wrap.style.opacity = show ? "1" : "0";
        wrap.style.transform = show ? "translateY(0)" : "translateY(10px)";
        wrap.style.pointerEvents = show ? "auto" : "none";
        wasVisible = show;
      }

      /* Ring: dashoffset + opacity */
      const ring = ringRef.current;
      if (ring) {
        ring.style.strokeDashoffset = String(C * (1 - progress));
        ring.style.opacity = progress > 0.01 ? "0.5" : "0";
      }

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update(); // initial state
    return () => window.removeEventListener("scroll", onScroll);
  }, [C]);

  /* ── Click: smooth scroll (press feedback is CSS :active) ──── */
  const scrollUp = () => window.scrollTo({ top: 0, behavior: "smooth" });

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div
      ref={wrapRef}
      className="fixed bottom-6 right-4 sm:bottom-8 sm:right-6 z-50"
      style={{
        opacity: 0,
        transform: "translateY(10px)",
        transition: "opacity 0.3s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        pointerEvents: "none",
      }}
    >
      {/* Button — ThemeToggle visual style + dock chip press behavior */}
      <button
        onClick={scrollUp}
        aria-label="Scroll to top"
        className="group relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border border-border/60 bg-bg-card/80 hover:bg-bg-elevated transition-all duration-200 active:scale-[0.97] active:duration-75 shadow-sm backdrop-blur-sm"
      >
        {/* ── Progress ring ───────────────────────────────────── */}
        <svg
          className="absolute inset-0 -rotate-90 pointer-events-none"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Ghost track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--olive)"
            strokeWidth={sw}
            opacity={0.08}
          />
          {/* Active arc */}
          <circle
            ref={ringRef}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--olive)"
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C}
            style={{
              opacity: 0,
              transition:
                "stroke-dashoffset 0.15s ease-out, opacity 0.3s ease",
            }}
          />
        </svg>

        {/* ── Chevron ─────────────────────────────────────────── */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[18px] h-[18px] transition-transform duration-300 ease-out group-hover:-translate-y-[2px] group-active:translate-y-0"
        >
          <path d="M6 15l6-6 6 6" stroke="var(--text-primary)" />
        </svg>
      </button>
    </div>
  );
}
