/**
 * Theme toggle sparkle effects powered by canvas-confetti.
 *
 * Two distinct moods:
 *
 * GOING DARK (night falls) — White/ice-blue STARS burst outward.
 *   Low gravity so they float like they're in space.
 *   Communicates: the night sky is appearing.
 *
 * GOING LIGHT (sunrise) — Golden CIRCLES radiate outward like sunbeams.
 *   Higher velocity, very low gravity — particles beam out, not fall.
 *   A second burst adds depth. Communicates: warmth, light, energy.
 */

import confetti from "canvas-confetti";

/** Convert a DOM element's center to canvas-confetti's 0-1 viewport coords. */
function originFrom(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return {
    x: (r.left + r.width / 2) / window.innerWidth,
    y: (r.top + r.height / 2) / window.innerHeight,
  };
}

/* ── Color palettes ──────────────────────────────────────────── */

const NIGHT = ["#ffffff", "#c8d6ff", "#a8c0ff", "#e0e8ff", "#ffe8a8"];
const SUN   = ["#FFD700", "#FFEC8B", "#FFA500", "#FFE066", "#FFB347", "#ffffff"];

/* ── Public API ──────────────────────────────────────────────── */

export function sparkleTheme(el: HTMLElement, goingDark: boolean) {
  const origin = originFrom(el);

  if (goingDark) {
    /* ── Night stars ── */
    confetti({
      particleCount: 18,
      spread: 360,
      startVelocity: 16,
      gravity: 0.3,
      scalar: 0.7,
      ticks: 140,
      colors: NIGHT,
      shapes: ["star"],
      origin,
      disableForReducedMotion: true,
    });
  } else {
    /* ── Sunrise shine ──
       First burst: fast golden circles radiating outward like sunbeams.
       Very low gravity — light doesn't fall. */
    confetti({
      particleCount: 20,
      spread: 360,
      startVelocity: 30,
      gravity: 0.15,
      scalar: 0.9,
      ticks: 120,
      colors: SUN,
      shapes: ["circle"],
      origin,
      disableForReducedMotion: true,
    });
    /* Second burst: slightly delayed, smaller, slower — afterglow */
    setTimeout(() => {
      confetti({
        particleCount: 10,
        spread: 360,
        startVelocity: 14,
        gravity: 0.1,
        scalar: 0.5,
        ticks: 100,
        colors: SUN,
        shapes: ["circle"],
        origin,
        disableForReducedMotion: true,
      });
    }, 100);
  }
}
