"use client";

import { useState, useEffect } from "react";

/**
 * Animated sun/moon toggle.
 *
 * How the animation works:
 * - Sun has a center circle (r=6) + 8 rays (short lines radiating out).
 * - Moon is a smaller circle (r=5) with a "mask" circle that overlaps to
 *   create a crescent shape.
 * - On toggle: the whole SVG rotates 180°, rays scale to 0 and fade,
 *   the mask circle slides in from the right, and the center circle shrinks.
 * - All animation is CSS transition — no JS animation frames, buttery 60fps.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  /* Read initial state from the DOM (set by the inline script in layout).
     We wait for mount to avoid hydration mismatch. */
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  /* Don't render until mounted to avoid flash of wrong icon */
  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border border-border/60 bg-bg-card/80 hover:bg-bg-elevated transition-colors duration-300 shadow-sm backdrop-blur-sm"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-[18px] h-[18px] transition-transform duration-500 ease-in-out"
        style={{ transform: dark ? "rotate(180deg)" : "rotate(0deg)" }}
      >
        {/* Center circle — larger for sun, smaller for moon */}
        <circle
          cx="12"
          cy="12"
          fill="var(--text-primary)"
          className="transition-all duration-500 ease-in-out"
          style={{ r: dark ? 5 : 5.5 }}
        />

        {/* Moon mask — overlapping circle that creates the crescent.
            Slides in from right (cx 20→15) when dark mode activates. */}
        <circle
          cx={dark ? 15.5 : 20}
          cy={dark ? 9 : 5}
          fill="var(--bg)"
          className="transition-all duration-500 ease-in-out"
          style={{ r: dark ? 5 : 0 }}
        />

        {/* Sun rays — 8 short lines radiating from center.
            Scale to 0 and fade when switching to moon. */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 12 + Math.cos(rad) * 8;
          const y1 = 12 + Math.sin(rad) * 8;
          const x2 = 12 + Math.cos(rad) * 10.5;
          const y2 = 12 + Math.sin(rad) * 10.5;
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--text-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              className="transition-all duration-500 ease-in-out origin-center"
              style={{
                opacity: dark ? 0 : 1,
                transform: dark ? "scale(0)" : "scale(1)",
                transformOrigin: "12px 12px",
              }}
            />
          );
        })}
      </svg>
    </button>
  );
}
