"use client";

import { useState, useEffect, useMemo, useRef } from "react";

/*  ═══════════════════════════════════════════════════════════════
    Ambient particles that float across the viewport.

    Dark mode  → twinkling starfield (white/blue dots, opacity pulse)
    Light mode → floating sunlit dust motes (golden, gentle drift)

    All CSS-only animations — no JS animation loop, no layout thrash.
    pointer-events: none so they never block content.
    ═══════════════════════════════════════════════════════════════ */

interface Star {
  id: number;
  x: number;        // % from left
  y: number;        // % from top
  size: number;     // px
  opacity: number;  // max opacity during twinkle
  duration: number; // animation cycle length (s)
  delay: number;    // animation delay (s)
  bright: boolean;  // brighter star with glow
}

interface Mote {
  id: number;
  x: number;        // starting % from left
  y: number;        // starting % from top
  size: number;     // px
  opacity: number;  // max opacity
  duration: number; // drift cycle (s)
  delay: number;    // animation delay (s)
  driftX: number;   // px horizontal drift
  driftY: number;   // px vertical drift (negative = upward)
}

interface ShootingStar {
  id: number;
  top: number;      // px from top
  right: number;    // px from right edge
  duration: number; // animation duration (s)
}

/* Deterministic seed: generate particles once on mount so positions
   don't jump between renders or hot reloads. */

function generateStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const bright = i < 4; // first 4 are "bright" stars
    stars.push({
      id: i,
      x: seededRand(i * 7 + 1) * 100,
      y: seededRand(i * 13 + 3) * 100,
      size: bright ? 2 + seededRand(i * 3) * 1.5 : 1 + seededRand(i * 5) * 1.5,
      opacity: bright ? 0.7 + seededRand(i * 11) * 0.3 : 0.2 + seededRand(i * 9) * 0.5,
      duration: 2.5 + seededRand(i * 17) * 4,
      delay: seededRand(i * 23) * 5,
      bright,
    });
  }
  return stars;
}

function generateMotes(count: number): Mote[] {
  const motes: Mote[] = [];
  for (let i = 0; i < count; i++) {
    motes.push({
      id: i,
      x: seededRand(i * 11 + 2) * 100,
      y: seededRand(i * 7 + 5) * 100,
      size: 1.5 + seededRand(i * 3 + 1) * 2,
      opacity: 0.15 + seededRand(i * 13 + 7) * 0.25,
      duration: 8 + seededRand(i * 19) * 12,
      delay: seededRand(i * 29) * 8,
      driftX: (seededRand(i * 31) - 0.5) * 60,
      driftY: -(10 + seededRand(i * 37) * 40), // always drift upward
    });
  }
  return motes;
}

/* Simple seeded pseudo-random: produces 0-1 from an integer seed.
   Gives us deterministic positions that survive re-renders. */
function seededRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const STAR_COUNT = 28;
const MOTE_COUNT = 18;

export default function AmbientParticles() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);

    /* Watch for theme changes (the toggle adds/removes .dark on <html>) */
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const stars = useMemo(() => generateStars(STAR_COUNT), []);
  const motes = useMemo(() => generateMotes(MOTE_COUNT), []);

  /* ── Shooting stars (dark mode only) ──
     Spawns a single streak every 8-22 seconds. Each one lives for
     the duration of its CSS animation, then gets cleaned out of state.
     The timer resets whenever `dark` toggles so light mode pays zero cost. */
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([]);
  const ssTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ssId = useRef(0);

  useEffect(() => {
    if (!dark || !mounted) {
      setShootingStars([]);
      return;
    }

    const spawn = () => {
      const id = ssId.current++;
      const star: ShootingStar = {
        id,
        top: Math.random() * 250,                  // upper portion of viewport
        right: Math.random() * 600,                // right side of viewport
        duration: 1 + Math.random() * 0.8,         // 1–1.8s
      };

      setShootingStars((prev) => [...prev, star]);

      // Clean up after animation finishes
      setTimeout(() => {
        setShootingStars((prev) => prev.filter((s) => s.id !== id));
      }, star.duration * 1000 + 300);

      // Schedule the next one — 8-22s gap
      ssTimeout.current = setTimeout(spawn, 8000 + Math.random() * 14000);
    };

    // First star after a short random wait
    ssTimeout.current = setTimeout(spawn, 4000 + Math.random() * 6000);

    return () => {
      if (ssTimeout.current) clearTimeout(ssTimeout.current);
    };
  }, [dark, mounted]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Transition container — fades between star layer and mote layer */}
      
      {/* ── Stars (dark mode) ── */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-in-out"
        style={{ opacity: dark ? 1 : 0 }}
      >
        {stars.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              backgroundColor: s.bright ? "#e0e8ff" : "#ffffff",
              opacity: 0,
              boxShadow: s.bright
                ? `0 0 ${s.size * 2}px rgba(200, 214, 255, 0.6), 0 0 ${s.size * 4}px rgba(200, 214, 255, 0.2)`
                : "none",
              animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
              "--twinkle-max": `${s.opacity}`,
            } as React.CSSProperties}
          />
        ))}

        {/* ── Shooting star ── */}
        {shootingStars.map((ss) => (
          <span
            key={ss.id}
            style={{
              position: "absolute",
              top: ss.top,
              right: ss.right,
              left: "initial",
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "#fff",
              boxShadow:
                "0 0 0 4px rgba(255,255,255,0.1), 0 0 0 8px rgba(255,255,255,0.1), 0 0 20px rgba(255,255,255,0.1)",
              animation: `shooting-star ${ss.duration}s ease-out forwards`,
            }}
          >
            {/* Tail — gradient line trailing behind the dot */}
            <span
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                transform: "translateY(-50%)",
                width: 150,
                height: 1,
                background: "linear-gradient(90deg, #fff, transparent)",
              }}
            />
          </span>
        ))}
      </div>

      {/* ── Dust motes (light mode) ── */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-in-out"
        style={{ opacity: dark ? 0 : 1 }}
      >
        {motes.map((m) => (
          <span
            key={m.id}
            className="absolute rounded-full"
            style={{
              left: `${m.x}%`,
              top: `${m.y}%`,
              width: m.size,
              height: m.size,
              backgroundColor: "#d4a04a",
              opacity: 0,
              boxShadow: `0 0 ${m.size * 1.5}px rgba(212, 160, 74, 0.3)`,
              animation: `float-mote ${m.duration}s ease-in-out ${m.delay}s infinite`,
              "--mote-max": `${m.opacity}`,
              "--mote-dx": `${m.driftX}px`,
              "--mote-dy": `${m.driftY}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
