"use client";

import { useState, useEffect, useRef } from "react";
import { sparkleTheme } from "@/lib/sparkles";

/**
 * Animated sun/moon toggle with canvas-confetti sparkle burst.
 *
 * On click:
 * 1. Button squeezes down then springs back (Web Animations API)
 * 2. Star-shaped confetti burst outward — icy blue for night, warm gold for day
 * 3. SVG icon rotates 180° with rays/crescent morph
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    const btn = btnRef.current;

    /* 1. Squeeze & bounce via Web Animations API */
    btn?.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(0.75)", offset: 0.18 },
        { transform: "scale(1.18)", offset: 0.48 },
        { transform: "scale(0.96)", offset: 0.72 },
        { transform: "scale(1)" },
      ],
      { duration: 450, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
    );

    /* 2. Confetti stars — slightly delayed so they burst at the bounce peak */
    setTimeout(() => {
      if (btn) sparkleTheme(btn, next);
    }, 100);

    /* 3. Theme change — slight delay for perceived cause → effect */
    setTimeout(() => {
      setDark(next);
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
    }, 70);
  };

  if (!mounted) {
    return <div className="w-10 h-10" />;
  }

  return (
    <button
      ref={btnRef}
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border border-border/60 bg-bg-card/80 hover:bg-bg-elevated transition-colors duration-300 shadow-sm backdrop-blur-sm"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-[18px] h-[18px] transition-transform duration-500 ease-in-out"
        style={{ transform: dark ? "rotate(180deg)" : "rotate(0deg)" }}
      >
        {/* Sun body / moon body */}
        <circle
          cx="12"
          cy="12"
          fill="var(--text-primary)"
          className="transition-all duration-500 ease-in-out"
          style={{ r: dark ? 5 : 5.5 }}
        />
        {/* Moon mask — slides in for crescent */}
        <circle
          cx={dark ? 15.5 : 20}
          cy={dark ? 9 : 5}
          fill="var(--bg)"
          className="transition-all duration-500 ease-in-out"
          style={{ r: dark ? 5 : 0 }}
        />
        {/* Sun rays — scale to 0 in dark mode */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={angle}
              x1={12 + Math.cos(rad) * 8}
              y1={12 + Math.sin(rad) * 8}
              x2={12 + Math.cos(rad) * 10.5}
              y2={12 + Math.sin(rad) * 10.5}
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
