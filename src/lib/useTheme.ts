"use client";

/* ---------------------------------------------------------------
   Theme + hydration hooks built on useSyncExternalStore — the
   React-sanctioned way to read external state (the .dark class on
   <html>, owned by the inline theme script and the toggle) without
   setState-in-effect cascades or hydration mismatches.
   --------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

function subscribeToThemeClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

/** True when dark mode is active. Always false during SSR/hydration;
    React re-renders with the real value immediately after hydration. */
export function useDarkMode(): boolean {
  return useSyncExternalStore(
    subscribeToThemeClass,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );
}

const emptySubscribe = () => () => {};

/** False during SSR and the hydration render, true afterwards.
    Replacement for the setMounted(true)-in-effect pattern. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
