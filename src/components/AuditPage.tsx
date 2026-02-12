"use client";

import { useState, useCallback, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AuditResult, CategoryScore } from "@/lib/audit/types";
import ScoreRing from "./ScoreRing";
import FixPlanDisplay from "./FixPlanDisplay";
import ColorRolesView from "./ColorRolesView";
import TypeScaleView from "./TypeScaleView";
import TypePaletteView from "./TypePaletteView";
import ColorPalette from "./ColorPalette";
import SprawlSection from "./SprawlSection";
import DesignTokensView, { countTokenMatches } from "./DesignTokensView";
import PatternsView from "./PatternsView";
import TextReveal from "./TextReveal";
import confetti from "canvas-confetti";
import gsap from "gsap";

type Status = "idle" | "running" | "done" | "error";

/* Client-side timeout for the entire audit request.
   If the server hasn't finished in 115s, we abort gracefully
   (server-side maxDuration is 120s, so 115s avoids a silent drop). */
const CLIENT_TIMEOUT_MS = 115_000;

/* ---- Typewriter ---- */

const ROTATE_WORDS = [
  "design system.",
  "color palette.",
  "type scale.",
  "spacing grid.",
  "visual tokens.",
];

function Typewriter({ startDelay = 0 }: { startDelay?: number }) {
  const [wordIdx, setWordIdx] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const pauseRef = useRef(false);
  const [ready, setReady] = useState(startDelay === 0);

  /* Wait for the entrance animation to reveal this line before typing */
  useEffect(() => {
    if (startDelay <= 0) return;
    const t = setTimeout(() => setReady(true), startDelay);
    return () => clearTimeout(t);
  }, [startDelay]);

  useEffect(() => {
    if (!ready) return;
    const word = ROTATE_WORDS[wordIdx];
    if (!deleting && text === word) {
      pauseRef.current = true;
      const t = setTimeout(() => {
        pauseRef.current = false;
        setDeleting(true);
      }, 2200);
      return () => clearTimeout(t);
    }
    if (deleting && text === "") {
      setDeleting(false);
      setWordIdx((prev) => (prev + 1) % ROTATE_WORDS.length);
      return;
    }
    const speed = deleting ? 35 : 70;
    const t = setTimeout(() => {
      setText((prev) =>
        deleting ? prev.slice(0, -1) : word.slice(0, prev.length + 1)
      );
    }, speed);
    return () => clearTimeout(t);
  }, [text, deleting, wordIdx, ready]);

  return (
    <span className="text-ds-olive">
      {text}
      <span
        className="inline-block w-[3px] h-[0.85em] bg-ds-olive/70 ml-0.5 align-baseline relative top-[0.05em]"
        style={{
          animation: ready ? "blink 1s step-end infinite" : "none",
          opacity: ready ? 1 : 0,
        }}
      />
    </span>
  );
}

/* ---- Example URLs ---- */

const EXAMPLES = ["stripe.com", "linear.app", "vercel.com"];

/* ---- Browser chrome ---- */

/** Share button with portaled tooltip so it isn't clipped by the card and sits below sticky elements (z-20). */
function ShareButtonWithTooltip({ onShare, shared }: { onShare: () => void; shared: boolean }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipRect, setTooltipRect] = useState<{ left: number; top: number } | null>(null);

  const updateRect = useCallback(() => {
    if (!shared || !buttonRef.current) {
      setTooltipRect(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setTooltipRect({
      left: rect.left - 8,
      top: rect.top + rect.height / 2,
    });
  }, [shared]);

  useLayoutEffect(() => {
    if (!shared) {
      setTooltipRect(null);
      return;
    }
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [shared, updateRect]);

  const tooltipEl =
    typeof document !== "undefined" &&
    shared &&
    tooltipRect &&
    createPortal(
      <span
        className="fixed whitespace-nowrap rounded-md bg-ds-olive px-2.5 py-1 text-[11px] font-medium text-white shadow-lg pointer-events-none transition-opacity duration-200 opacity-100"
        style={{
          left: tooltipRect.left,
          top: tooltipRect.top,
          transform: "translate(-100%, -50%)",
          zIndex: 20,
        }}
      >
        Link copied — go share it!
      </span>,
      document.body
    );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onShare}
        className="group/share relative flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer transition-all duration-150 hover:bg-ds-olive/10 active:scale-95"
        title="Copy report link"
      >
        {shared ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ds-olive transition-colors">
            <path d="M2.5 7.5L5.5 10.5L11.5 3.5" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-ds-tertiary group-hover/share:text-ds-olive transition-colors">
            <path d="M8.5 1.5h4v4" />
            <path d="M12.5 1.5L7 7" />
            <path d="M11 8v3.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H6" />
          </svg>
        )}
      </button>
      {tooltipEl}
    </>
  );
}

function BrowserChrome({
  url,
  ghost,
  sticky,
  onShare,
  shared,
  onUrlClick,
  onClose,
  onMinimize,
  onExpand,
  expanded,
}: {
  url: string;
  ghost?: boolean;
  sticky?: boolean;
  onShare?: () => void;
  shared?: boolean;
  onUrlClick?: () => void;
  onClose?: () => void;
  onMinimize?: () => void;
  onExpand?: () => void;
  expanded?: boolean;
}) {
  const inner = (
    <div
      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 border-b ${
        ghost
          ? "border-border/30 bg-bg-card/30"
          : "border-border/40 bg-[var(--bg-elevated)]"
      }`}
    >
      <div className="flex gap-1.5 shrink-0">
        {onClose ? (
          <button
            onClick={onClose}
            aria-label="Close analysis"
            className="group relative flex items-center justify-center w-5 h-5 -m-1.5 rounded-full cursor-pointer transition-colors duration-150 hover:bg-ds-red/15 active:bg-ds-red/25"
          >
            <span className="block w-2 h-2 rounded-full bg-ds-red" />
          </button>
        ) : (
          <div className="w-2 h-2 rounded-full bg-ds-red/40" />
        )}
        {onMinimize ? (
          <button
            onClick={onMinimize}
            aria-label="Minimize"
            className="group relative flex items-center justify-center w-5 h-5 -m-1.5 rounded-full cursor-pointer transition-colors duration-150 hover:bg-ds-amber/15 active:bg-ds-amber/25"
          >
            <span className="block w-2 h-2 rounded-full bg-ds-amber" />
          </button>
        ) : (
          <div className="w-2 h-2 rounded-full bg-ds-amber/40" />
        )}
        {onExpand ? (
          <button
            onClick={onExpand}
            aria-label={expanded ? "Exit fullscreen" : "Expand fullscreen"}
            className="group relative flex items-center justify-center w-5 h-5 -m-1.5 rounded-full cursor-pointer transition-colors duration-150 hover:bg-ds-green/15 active:bg-ds-green/25"
          >
            <span className="block w-2 h-2 rounded-full bg-ds-green" />
          </button>
        ) : (
          <div className="w-2 h-2 rounded-full bg-ds-green/40" />
        )}
      </div>
      <div className="flex-1 flex justify-center min-w-0">
        {ghost || !onUrlClick ? (
          <div
            className={`px-3 py-0.5 rounded-md bg-[var(--surface-url)] text-[11px] font-mono truncate max-w-[220px] sm:max-w-sm ${
              ghost ? "text-ds-tertiary/50" : "text-ds-tertiary"
            }`}
          >
            {url}
          </div>
        ) : (
          <button
            onClick={onUrlClick}
            className="px-3 py-0.5 rounded-md bg-[var(--surface-url)] text-[11px] font-mono truncate max-w-[220px] sm:max-w-sm text-ds-tertiary cursor-pointer transition-all duration-150 hover:bg-ds-olive/10 hover:text-ds-secondary active:scale-[0.97] active:bg-ds-olive/15 active:duration-75"
          >
            {url}
          </button>
        )}
      </div>
      {/* Share button (results) or spacer (ghost) */}
      <div className="w-8 sm:w-10 shrink-0 flex justify-end">
        {onShare && (
          <ShareButtonWithTooltip onShare={onShare} shared={!!shared} />
        )}
      </div>
    </div>
  );

  if (!sticky) return inner;

  return (
    <div className="sticky top-0 z-50">
      {inner}
    </div>
  );
}

/* ---- Ghost preview ---- */

const GR = 28;
const GC = 2 * Math.PI * GR;
const GO = GC - 0.74 * GC;

function GhostPreview() {
  return (
    <div className="relative mt-4 rounded-2xl border border-border/50 bg-bg-card/40 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <BrowserChrome url="your-website.com" ghost />
      <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-16">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
              <circle cx="36" cy="36" r={GR} fill="none" stroke="var(--border)" strokeWidth="3.5" opacity="0.3" />
              <circle cx="36" cy="36" r={GR} fill="none" stroke="var(--olive)" strokeWidth="3.5" strokeDasharray={GC} strokeDashoffset={GO} strokeLinecap="round" opacity="0.25" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-serif text-ds-olive/30">B</span>
            </div>
          </div>
          <span className="text-sm font-mono text-ds-tertiary/40">
            74 <span className="text-ds-tertiary/25">/ 100</span>
          </span>
        </div>
        <div className="flex justify-center gap-1.5 mb-8 flex-wrap">
          {[{ n: "Colors", g: "B" }, { n: "Spacing", g: "A" }, { n: "Sizes", g: "C" }, { n: "Radii", g: "A" }, { n: "Families", g: "B" }].map((p) => (
            <div key={p.n} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ds-olive-50/40 text-[10px] text-ds-tertiary/40">
              {p.n} <span className="font-mono font-bold text-ds-olive/30">{p.g}</span>
            </div>
          ))}
        </div>
        <div className="max-w-md mx-auto space-y-2">
          {[{ w: 78, l: "16px" }, { w: 60, l: "24px" }, { w: 45, l: "14px" }, { w: 33, l: "32px" }, { w: 20, l: "12px" }].map((b) => (
            <div key={b.l} className="flex items-center gap-3">
              <span className="w-10 text-right text-[11px] font-mono text-ds-tertiary/30">{b.l}</span>
              <div className="flex-1 h-4 bg-surface-subtle rounded-sm overflow-hidden">
                <div className="h-full bg-ds-olive-100/30 rounded-sm" style={{ width: `${b.w}%` }} />
              </div>
              <span className="w-6 text-right text-[10px] font-mono text-ds-tertiary/20">{Math.round(b.w * 0.6)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/80 to-transparent pointer-events-none" />
    </div>
  );
}

/* ---- Lighten a hex color toward white ---- */

function lightenHex(hex: string, mix = 0.65): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#b8c99a";
  const lr = Math.round(r + (255 - r) * mix);
  const lg = Math.round(g + (255 - g) * mix);
  const lb = Math.round(b + (255 - b) * mix);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

/* ---- Extract dominant colors ---- */

function useDominantColors(result: AuditResult | null) {
  return useMemo(() => {
    const fallback = "#b8c99a";
    if (!result) return { primary: fallback, secondary: fallback };

    const nonNeutral = result.colorSprawl.hueGroups
      .filter(
        (g) =>
          !["Neutral", "Gray", "Near-white", "Near-black"].includes(g.name)
      )
      .flatMap((g) => g.colors)
      .sort((a, b) => b.count - a.count);

    const raw1 = nonNeutral[0]?.hex || fallback;
    const raw2 = nonNeutral[2]?.hex || nonNeutral[1]?.hex || fallback;

    return {
      primary: lightenHex(raw1, 0.65),
      secondary: lightenHex(raw2, 0.7),
    };
  }, [result]);
}

/* ---- Config ---- */

const gradeColor: Record<string, string> = {
  A: "text-ds-green",
  B: "text-ds-blue",
  C: "text-ds-amber",
  D: "text-ds-red",
  F: "text-ds-red",
};

const gradePillBg: Record<string, string> = {
  A: "bg-[var(--grade-green-bg)] border-[var(--grade-green-border)]",
  B: "bg-[var(--grade-blue-bg)] border-[var(--grade-blue-border)]",
  C: "bg-[var(--grade-amber-bg)] border-[var(--grade-amber-border)]",
  D: "bg-[var(--grade-red-bg)] border-[var(--grade-red-border)]",
  F: "bg-[var(--grade-red-bg)] border-[var(--grade-red-border)]",
};

const confColor: Record<string, string> = {
  low: "text-ds-red",
  medium: "text-ds-amber",
  high: "text-ds-green",
};

/* ---- Collapsible section group ----
   Wraps a family of related sub-sections (e.g. all typography analysis)
   under a single header that toggles the whole group open/closed.
   When forceOpen is true (search active), the group is always expanded. */

/* Sticky offset for L1 section headers.
   Normal (inline card): browser chrome height + search bar height.
   Modal: chrome is outside the scroll container, so only search-bar height. */

function SectionGroup({
  label,
  detail,
  first,
  defaultOpen = true,
  forceOpen,
  filterQuery,
  matchCount,
  stickyTop,
  children,
}: {
  label: string;
  detail?: string;
  first?: boolean;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  filterQuery?: string;
  matchCount?: number;
  stickyTop?: number;
  children: React.ReactNode;
}) {
  const [userOpen, setUserOpen] = useState(defaultOpen);
  /* When search is active, sections auto-expand but the user can still
     manually collapse them. We track that override separately and reset
     it whenever the query text changes. */
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const prevQuery = useRef(filterQuery);
  if (filterQuery !== prevQuery.current) {
    prevQuery.current = filterQuery;
    if (searchCollapsed) setSearchCollapsed(false);
  }

  const query = (filterQuery || "").toLowerCase().trim();
  const labelMatch = query ? label.toLowerCase().includes(query) : false;

  /* Determine open state */
  const searchWantsOpen = forceOpen || labelMatch;
  const open = searchWantsOpen ? !searchCollapsed : userOpen;

  const toggle = () => {
    if (searchWantsOpen) {
      setSearchCollapsed(!searchCollapsed);
    } else {
      setUserOpen(!userOpen);
    }
  };

  return (
    <div className={first ? "pt-5 sm:pt-6" : "pt-4 sm:pt-5"}>
      <div
        className="sticky z-30 -mx-5 sm:-mx-8 px-4 sm:px-7 pt-2.5 pb-1 pointer-events-none"
        style={{ top: stickyTop ?? 100 }}
      >
        <button
          onClick={toggle}
          className={[
            "w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl cursor-pointer pointer-events-auto min-w-0",
            "border border-border bg-bg-card backdrop-blur-sm shadow-sm",
            "transition-all duration-150 ease-out",
            "hover:border-ds-olive/30 hover:shadow-md hover:bg-surface-subtle",
            "active:scale-[0.99] active:shadow-none active:border-ds-olive/40 active:bg-ds-olive/10 active:duration-75",
          ].join(" ")}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 text-ds-olive transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
          >
            <path d="M4.5 2L8.5 6L4.5 10" />
          </svg>
          <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-ds-olive truncate">
            {label}
          </span>
          {detail && !query && (
            <span className="hidden sm:inline text-xs text-ds-tertiary font-mono ml-1 truncate">
              {detail}
            </span>
          )}
          {/* Result count badge — visible during search */}
          {query && matchCount !== undefined && (
            <span className="ml-auto text-[10px] font-mono font-medium text-ds-olive bg-ds-olive/10 border border-ds-olive/20 px-2 py-0.5 rounded-full leading-none">
              {matchCount}
            </span>
          )}
        </button>
      </div>
      {open && <div className="pt-2">{children}</div>}
    </div>
  );
}

/* ── Stepped progress ── */

const STEPS = [
  { id: "connect", label: "Connecting to page", phases: ["launching", "loading", "waiting"] },
  { id: "sample", label: "Sampling DOM elements", phases: ["sampling", "sampled", "fonts"] },
  { id: "analyze", label: "Analyzing styles", phases: ["colors", "type", "spacing", "misc"] },
  { id: "detect", label: "Detecting patterns", phases: ["typeScale", "colorRoles", "textStyles", "patterns"] },
  { id: "score", label: "Computing scores", phases: ["scoring", "fixplan"] },
];

function phaseToStepIdx(phase: string): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].phases.includes(phase)) return i;
  }
  return 0;
}

function SteppedProgress({ phase, message }: { phase: string; message: string }) {
  const activeIdx = phaseToStepIdx(phase);

  return (
    <div className="py-8 sm:py-10 space-y-3">
      {STEPS.map((step, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div
            key={step.id}
            className="flex items-center gap-3"
            style={{
              /* Stagger entrance: each step fades up 70ms after the previous.
                 animation-fill-mode: both keeps it invisible until its delay fires.
                 Stable keys mean React reuses these DOM nodes — the animation
                 only fires once on mount, not on every phase update. */
              animation: `fadeUpSmall 0.35s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.07}s both`,
            }}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
              done
                ? "bg-ds-olive"
                : active
                  ? "border-2 border-ds-olive"
                  : "border-2 border-border"
            }`}>
              {done && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {active && (
                <div className="w-2 h-2 rounded-full bg-ds-olive animate-pulse" />
              )}
            </div>
            <span className={`text-sm transition-colors ${
              done
                ? "text-ds-tertiary line-through"
                : active
                  ? "text-ds-primary font-medium"
                  : "text-ds-tertiary"
            }`}>
              {active ? message : step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── PAGE ── */

export default function AuditPage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState("");
  const [phase, setPhase] = useState("launching");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const colors = useDominantColors(result);

  /* AbortController ref — lets us cancel in-flight requests
     when the user clicks Cancel or the timeout fires. */
  const abortRef = useRef<AbortController | null>(null);

  /* Tracks whether the card was restored from minimize — prevents
     the results entrance animation from re-triggering after restore. */
  const wasRestored = useRef(false);

  /* Bumps on every new error to re-trigger the shake animation. */
  const [errorKey, setErrorKey] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const [modalMinimizing, setModalMinimizing] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [minimizing, setMinimizing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [dockExiting, setDockExiting] = useState(false);
  const [ghostExiting, setGhostExiting] = useState(false);
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  /* ── Smooth height transition for the swappable content area ──
     A ResizeObserver watches the inner wrapper. When the content swaps
     (ghost → progress → results), we set an explicit height on the outer
     container and let CSS transition: height do the interpolation.
     We freeze the height while the modal is expanded because the card
     content is portalled to document.body and swapInnerRef is empty. */
  const swapInnerRef = useRef<HTMLDivElement>(null);
  const [swapHeight, setSwapHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = swapInnerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      if (expanded) return; // content is in a portal — keep the frozen height
      for (const entry of entries) {
        setSwapHeight(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);
  const showError = useCallback((msg: string) => {
    setError(msg);
    setErrorKey((k) => k + 1);
  }, []);

  /* ── Page entrance animation ──
     Orchestrates a top-down waterfall reveal on first load.
     CSS [data-enter] rule hides elements from first paint (SSR-safe).
     GSAP timeline fades them up in reading order with overlapping starts.
     On complete, inline styles are cleared and [data-page-entered] is set
     so remounted elements (e.g. ghost on reset) stay visible. */
  const containerRef = useRef<HTMLDivElement>(null);
  const entranceTl = useRef<gsap.core.Timeline | null>(null);
  const hasAnimated = useRef(false);

  useLayoutEffect(() => {
    if (hasAnimated.current || !containerRef.current) return;
    hasAnimated.current = true;

    const container = containerRef.current;
    const ctx = gsap.context(() => {
      /* ── Initial states — varied motion character per element type ──
         Tag: horizontal slide (status indicator slides in from left)
         Title: deep rise + blur clear (hero text materialises from fog)
         Desc: standard gentle rise
         Input: rise + scale inflate (interactive element pops in)
         Btn: horizontal slide from left (separate from input parent)
         Badges: gentle opacity + small rise (no scale)
         Ghost: large rise + scale + blur (heavy card ascends into place)
         Footer: gentle fade-up */
      gsap.set('[data-enter="tag"]',     { opacity: 0, x: -20 });
      gsap.set('[data-enter="title-1"]', { opacity: 0, y: 32, filter: 'blur(8px)' });
      gsap.set('[data-enter="title-2"]', { opacity: 0, y: 28, filter: 'blur(6px)' });
      gsap.set('[data-enter="desc"]',    { opacity: 0, y: 20 });
      gsap.set('[data-enter="input"]',   { opacity: 0, y: 20, scale: 0.98 });
      gsap.set('[data-enter="ex-item"]', { opacity: 0, y: 6 });
      gsap.set('[data-enter="btn"]',     { opacity: 0, x: -10 });
      gsap.set('[data-enter="ghost"]',   { opacity: 0, y: 48, scale: 0.96, filter: 'blur(4px)' });
      gsap.set('[data-enter="footer"]',  { opacity: 0, y: 16 });

      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          /* Clean up: remove GSAP inline styles, mark entrance done */
          container.querySelectorAll('[data-enter]').forEach(el => {
            gsap.set(el, { clearProps: 'all' });
          });
          container.setAttribute('data-page-entered', '');
          entranceTl.current = null;
        },
      });

      entranceTl.current = tl;

      /* Phase 1 — Hero: the eye-catching stuff */
      tl.to('[data-enter="tag"]',      { opacity: 1, x: 0, duration: 0.7, ease: 'power2.out' }, 0.05)
        .to('[data-enter="title-1"]',  { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8 }, 0.12)
        .to('[data-enter="title-2"]',  { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7 }, 0.35)
      /* Phase 2 — Supporting copy (bigger gap = breathing room after the hero) */
        .to('[data-enter="desc"]',     { opacity: 1, y: 0, duration: 0.6 }, 0.55)
      /* Phase 3 — Interactive elements inflate into place */
        .to('[data-enter="input"]',    { opacity: 1, y: 0, scale: 1, duration: 0.55 }, 0.7)
        .to('[data-enter="btn"]',      { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' }, 0.8)
        .to('[data-enter="ex-item"]',  { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'sine.out' }, 0.95)
      /* Phase 4 — Visual anchor: the heavy card rises last */
        .to('[data-enter="ghost"]',    { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'power2.out' }, 1.05)
      /* Phase 5 — Footer: quiet coda */
        .to('[data-enter="footer"]',   { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.3);
    }, container);

    return () => ctx.revert();
  }, []);

  /* ── Button animation system ── */
  const btnRef = useRef<HTMLButtonElement>(null);

  /* Shake on Cancel click — emphasize the destructive action, then reset */
  const cancel = useCallback(() => {
    const btn = btnRef.current;
    if (btn) {
      btn.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-5px)", offset: 0.1 },
          { transform: "translateX(5px)", offset: 0.25 },
          { transform: "translateX(-4px)", offset: 0.4 },
          { transform: "translateX(4px)", offset: 0.55 },
          { transform: "translateX(-2px)", offset: 0.7 },
          { transform: "translateX(2px)", offset: 0.85 },
          { transform: "translateX(0)" },
        ],
        { duration: 400, easing: "ease-in-out" }
      );
    }
    /* Slight delay so the shake is visible before the state resets */
    setTimeout(() => {
      abortRef.current?.abort();
      abortRef.current = null;
      setGhostExiting(false);
      if (ghostTimerRef.current) { clearTimeout(ghostTimerRef.current); ghostTimerRef.current = null; }
      setStatus("idle");
      setProgress("");
    }, 200);
  }, []);

  /* Reset everything back to the initial "just visited" state */
  const clearAnalysis = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setResult(null);
    setProgress("");
    setError("");
    setCopied(false);
    setFilterQuery("");
    setExpanded(false);
    setModalClosing(false);
    setModalMinimizing(false);
    setMinimized(false);
    setMinimizing(false);
    setRestoring(false);
    setDockExiting(false);
    setGhostExiting(false);
    if (ghostTimerRef.current) { clearTimeout(ghostTimerRef.current); ghostTimerRef.current = null; }
    wasRestored.current = false;
    setUrl("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => urlInputRef.current?.focus(), 400);
  }, []);

  /* Collapse the fullscreen modal with an exit animation */
  const collapseModal = useCallback(() => {
    if (!expanded || modalClosing || modalMinimizing) return;
    setModalClosing(true);
    /* Wait for exit animation to finish before unmounting.
       Card: 0.3s  Backdrop: 0.05s delay + 0.25s = 0.3s total. */
    setTimeout(() => {
      setExpanded(false);
      setModalClosing(false);
    }, 300);
  }, [expanded, modalClosing, modalMinimizing]);

  /* Minimize the card into the dock chip — the macOS yellow-dot easter egg */
  const minimizeCard = useCallback(() => {
    if (minimized || minimizing || modalMinimizing) return;
    if (expanded) {
      /* From modal → dock chip directly.
         Play a shrink-down animation on the modal, then jump straight
         to minimized. The inline card is never rendered in between. */
      setModalMinimizing(true);
      setTimeout(() => {
        setModalMinimizing(false);
        setExpanded(false);
        wasRestored.current = true; // so restore skips first-entrance animation
        setMinimized(true);
      }, 400);
    } else {
      setMinimizing(true);
      setTimeout(() => {
        setMinimizing(false);
        setMinimized(true);
      }, 400);
    }
  }, [minimized, minimizing, modalMinimizing, expanded]);

  /* Restore the card from the dock chip.
     Brief exit animation on dock → then card scales back up. */
  const restoreCard = useCallback(() => {
    if (!minimized || restoring || dockExiting) return;
    setDockExiting(true);
    setTimeout(() => {
      setDockExiting(false);
      wasRestored.current = true;
      setRestoring(true);
      setMinimized(false);
      /* Shell 0.4s + content delay 0.12s + content 0.35s = ~0.87s total.
         Clear restoring after the content is fully opaque. */
      setTimeout(() => setRestoring(false), 500);
    }, 180);
  }, [minimized, restoring, dockExiting]);

  /* Clean up on unmount (e.g. user navigates away) */
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  /* Lock body scroll while modal is open */
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [expanded]);

  /* ⌘F / Ctrl+F to focus search, Esc to clear or close modal */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        /* Only intercept when results are visible */
        if (searchRef.current && result && status === "done") {
          e.preventDefault();
          searchRef.current.focus();
        }
      }
      if (e.key === "Escape") {
        if (document.activeElement === searchRef.current) {
          e.preventDefault();
          setFilterQuery("");
          searchRef.current?.blur();
        } else if (expanded) {
          e.preventDefault();
          collapseModal();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [result, status, expanded, collapseModal]);

  const run = useCallback(
    async (overrideUrl?: string) => {
      const targetUrl = (overrideUrl || url).trim();
      if (!targetUrl) return;

      /* Cancel any in-flight request first */
      abortRef.current?.abort();

      /* Complete entrance animation instantly if still in progress —
         prevents GSAP from fighting the ghost exit CSS animation. */
      if (entranceTl.current?.isActive()) entranceTl.current.progress(1);

      const controller = new AbortController();
      abortRef.current = controller;

      if (overrideUrl) setUrl(overrideUrl);
      wasRestored.current = false;

      /* Start ghost exit animation before swapping to progress.
         The ghost stays mounted for 350ms (its exit animation duration),
         then unmounts and the staggered progress steps appear. */
      setGhostExiting(true);
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
      ghostTimerRef.current = setTimeout(() => {
        setGhostExiting(false);
        ghostTimerRef.current = null;
      }, 350);

      setStatus("running");
      setProgress("Connecting…");
      setPhase("launching");
      setError("");
      setResult(null);
      setCopied(false);

      /* Auto-timeout: if the audit takes longer than CLIENT_TIMEOUT_MS,
         abort the request so the user isn't left hanging. */
      const timer = setTimeout(() => {
        controller.abort();
        showError("The audit timed out. The target site may be too complex or slow to respond. Try a simpler page.");
        setStatus("error");
      }, CLIENT_TIMEOUT_MS);

      try {
        const res = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `The server returned an error (HTTP ${res.status}). Please try again.`);
        }
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "progress") {
                setProgress(evt.message);
                if (evt.phase) setPhase(evt.phase);
              }
              else if (evt.type === "complete") {
                setResult(evt.data as AuditResult);
                setStatus("done");
              } else if (evt.type === "error") throw new Error(evt.message);
            } catch (e) {
              if (e instanceof Error && e.message) {
                showError(e.message);
                setStatus("error");
              }
            }
          }
        }
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        showError(
          e instanceof Error
            ? e.message
            : "Something unexpected happened. Check your connection and try again."
        );
        setStatus("error");
      } finally {
        clearTimeout(timer);
      }
    },
    [url, showError]
  );

  /* Auto-run audit when opened with ?url= query param (shared links).
     Runs once on mount, then clears the param from the URL bar. */
  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("url");
    if (sharedUrl) {
      didAutoRun.current = true;
      /* Clean the URL bar so refreshing doesn't re-trigger */
      window.history.replaceState({}, "", window.location.pathname);
      run(sharedUrl);
    }
  }, [run]);

  const scoreFor = (name: string): CategoryScore | undefined =>
    result?.scores.categories.find((c) => c.name === name);

  const offGridSet = result
    ? new Set(result.spacingSprawl.offGrid.map((v) => v.value))
    : new Set<string>();

  const handleCopy = () => {
    if (!result) return;
    const shareUrl = `${window.location.origin}/?url=${encodeURIComponent(result.url)}`;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fireConfetti = useCallback(() => {
    const end = Date.now() + 1800;
    const colors = ["#15803d", "#22c55e", "#86efac", "#5c6e3c"];
    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, []);

  /* Consistent inner padding for the browser window */
  const inPad = "px-5 sm:px-8";

  return (
    <div ref={containerRef} data-page-enter className="relative max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* ── Animated gradient orbs (outside overflow clip) ──
           orbReveal fades opacity from 0 → the element's Tailwind value.
           Runs alongside drift (transform-only) with no conflict. */}
      <div
        className="pointer-events-none fixed top-0 left-0 w-[420px] sm:w-[520px] h-[420px] sm:h-[520px] rounded-full opacity-[0.18]"
        style={{
          backgroundColor: colors.primary,
          filter: "blur(90px)",
          transition: "background-color 2s ease",
          animation: "drift 25s ease-in-out infinite, orbReveal 2.5s ease-out both",
        }}
      />
      <div
        className="pointer-events-none fixed bottom-0 right-0 w-[300px] sm:w-[380px] h-[300px] sm:h-[380px] rounded-full opacity-[0.12]"
        style={{
          backgroundColor: colors.secondary,
          filter: "blur(90px)",
          transition: "background-color 2s ease",
          animation: "drift2 30s ease-in-out infinite, orbReveal 2.5s ease-out 0.4s both",
        }}
      />

      {/* ── Hero ── */}
      <header className="relative mb-10 sm:mb-14">
        <div data-enter="tag" className="flex items-center gap-2 mb-4 sm:mb-5 sm:-ml-[14px]">
          <span
            className="w-1.5 h-1.5 rounded-full bg-ds-olive"
            style={{ animation: "pulse-dot 2.5s ease-in-out infinite" }}
          />
          <span className="text-xs sm:text-sm font-medium text-ds-olive tracking-wide">
            Visual design system analysis
          </span>
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif tracking-tight text-ds-primary leading-[0.95]">
          <span data-enter="title-1" className="block">Diagnose your</span>
          <span data-enter="title-2" className="block"><Typewriter startDelay={1000} /></span>
        </h1>
        <p data-enter="desc" className="text-base sm:text-lg text-ds-secondary mt-5 sm:mt-6 max-w-lg leading-relaxed">
          Paste any URL and get an instant diagnostic on visual consistency
          — colors, spacing, typography, and layout tokens.
        </p>
      </header>

      {/* ── Input ── */}
      <div data-enter="input" className="relative mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            ref={urlInputRef}
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            disabled={status === "running"}
            className="w-full sm:flex-1 h-13 sm:h-14 px-4 sm:px-5 rounded-xl bg-bg-card border border-border text-base font-mono text-ds-primary placeholder:text-ds-tertiary focus:outline-none focus:border-ds-olive focus:ring-2 focus:ring-ds-olive/20 disabled:opacity-50 transition-colors shadow-sm"
          />
          {/* ── Action button ── */}
          <div data-enter="btn" className="relative shrink-0 group" style={{ minWidth: "7.5rem" }}>
            <button
              ref={btnRef}
              onClick={status === "running" ? cancel : () => run()}
              disabled={status !== "running" && !url.trim()}
              className="relative h-13 sm:h-14 rounded-xl text-base font-semibold cursor-pointer whitespace-nowrap shadow-sm shrink-0 disabled:opacity-50 overflow-hidden transition-colors duration-300 ease-in-out w-full"
            >
              {/* Invisible sizer keeps button width stable */}
              <span className="invisible px-6 sm:px-8" aria-hidden="true">Analyze</span>

              {/* Layer 1: Analyze label (olive) */}
              <span
                className={`absolute inset-0 flex items-center justify-center rounded-xl text-white transition-opacity duration-300 ease-in-out bg-ds-olive hover:bg-ds-olive/90 ${
                  status === "running" ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
              >
                Analyze
              </span>

              {/* Layer 2: Loading bar (muted red) — replaces Cancel label */}
              <span
                className={`absolute inset-0 flex items-center justify-center rounded-xl transition-opacity duration-300 ease-in-out bg-ds-red/80 ${
                  status === "running" ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {/* Indeterminate loading bar: 32px track with sliding fill */}
                <span className="relative w-8 h-[3px] rounded-full bg-white/20 overflow-hidden">
                  <span
                    className="absolute inset-y-0 w-2/3 rounded-full bg-white/70"
                    style={{ animation: "loading-slide 1.4s ease-in-out infinite" }}
                  />
                </span>
              </span>
            </button>

            {/* Tooltip — appears on hover only during running state */}
            {status === "running" && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 rounded-md bg-bg-elevated border border-border text-[11px] text-ds-secondary whitespace-nowrap shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30">
                Stop analysis
                {/* Tooltip arrow */}
                <span className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-bg-elevated border-l border-t border-border" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Examples ── */}
      <div className="flex items-center gap-2 sm:gap-2.5 mb-8 sm:mb-10 flex-wrap">
        <span data-enter="ex-item" className="text-xs text-ds-tertiary">Try</span>
        {EXAMPLES.map((ex) => (
          <button
            data-enter="ex-item"
            key={ex}
            onClick={() => run(`https://${ex}`)}
            disabled={status === "running"}
            className="text-xs font-mono px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-bg-card/70 border border-border text-ds-secondary hover:border-ds-olive/50 hover:text-ds-olive cursor-pointer transition-all disabled:opacity-40 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* ── Swappable content area — height-transitions between states ──
           overflow-clip (not overflow-hidden) clips content during the
           height transition WITHOUT creating a scroll container, so
           position:sticky on the chrome bar / section headers still works. */}
      <div
        className="overflow-clip transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ height: swapHeight != null ? swapHeight : undefined }}
      >
        <div ref={swapInnerRef}>

      {/* ── Ghost (idle) ── stays mounted during exit animation */}
      {(status === "idle" || ghostExiting) && (
        <div
          data-enter="ghost"
          style={ghostExiting && status !== "idle" ? {
            animation: "ghostExit 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          } : undefined}
        >
          <GhostPreview />
        </div>
      )}

      {/* ── Progress ── appears after ghost finishes exiting */}
      {status === "running" && !ghostExiting && (
        <SteppedProgress phase={phase} message={progress} />
      )}

      {/* ── Error ── */}
      {status === "error" && (
        <div
          key={errorKey}
          className="rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 sm:px-5 py-3 sm:py-4 text-sm text-ds-red"
          style={{ animation: "error-shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both" }}
        >
          {error}
        </div>
      )}

      {/* ═══════════ RESULTS ═══════════ */}
      {result && status === "done" && (() => {
        const chrome = (
          <BrowserChrome
            url={result.url}
            sticky
            onShare={handleCopy}
            shared={copied}
            onClose={expanded ? collapseModal : clearAnalysis}
            onMinimize={minimizeCard}
            onExpand={() => expanded ? collapseModal() : setExpanded(true)}
            expanded={expanded}
            onUrlClick={expanded ? () => {
              collapseModal();
              window.scrollTo({ top: 0, behavior: "smooth" });
              setTimeout(() => urlInputRef.current?.focus(), 400);
            } : () => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              setTimeout(() => urlInputRef.current?.focus(), 400);
            }}
          />
        );

        const cardBody = (
          <>

          {/* ── Score ── */}
          <div className={`${inPad} py-8 sm:py-10`}>
            <div className="flex flex-col items-center">
              <ScoreRing
                score={result.scores.overall}
                grade={result.scores.grade}
                label="Design Consistency"
                onAce={fireConfetti}
              />
              <div className="flex items-center gap-2 mt-4 text-xs flex-wrap justify-center">
                <span className={`font-mono font-medium ${confColor[result.scores.confidence]}`}>
                  {result.scores.confidence} confidence
                </span>
                <span className="text-ds-tertiary">·</span>
                <span className="text-ds-tertiary font-mono">
                  {result.elementCount} elements
                </span>
                
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-border">
              {result.scores.categories.slice(0, 5).map((c, i) => (
                <div
                  key={c.name}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg border animate-fade-up ${gradePillBg[c.grade]}`}
                  style={{ animationDelay: `${1.0 + i * 0.08}s` }}
                >
                  <span className="text-xs text-ds-secondary">{c.name}</span>
                  <span className={`text-xs sm:text-sm font-bold font-mono ${gradeColor[c.grade]}`}>
                    {c.grade}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Aggressive mode: results likely wrong ── */}
          {result.aggressiveMode && (
            <div className={`${inPad} py-4 sm:py-5 bg-ds-amber/10 border-y border-ds-amber/30`}>
              <div className="flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 mt-0.5 text-ds-amber" aria-hidden>
                  <path d="M10 2L18 16H2L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M10 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="10" cy="12.5" r="1" fill="currentColor" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-ds-amber">
                    Results may be wrong — fallback mode was used
                  </p>
                  <p className="text-sm text-ds-secondary mt-1 leading-relaxed">
                    This site was audited in fallback mode because the browser ran out of resources (the page was too heavy). JavaScript was disabled and many resources were blocked, so typography, colours, and layout data are likely incomplete or inaccurate. Try again later or audit a lighter page for reliable results.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Analysis warnings (degraded steps) ── */}
          {result.warnings && result.warnings.length > 0 && (
            <div className={`${inPad} py-3 bg-ds-amber/5 border-y border-ds-amber/20`}>
              <div className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5 text-ds-amber">
                  <path d="M7 1L13 12H1L7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  <path d="M7 5.5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <circle cx="7" cy="9.75" r="0.5" fill="currentColor" />
                </svg>
                <div className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-ds-amber leading-relaxed">{w}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Findings ── */}
          {result.fixPlan.length > 0 && (
            <div className={`${inPad} py-4 sm:py-5 bg-[var(--warning-bg)] border-y border-[var(--warning-border)]`}>
              <FixPlanDisplay actions={result.fixPlan} />
            </div>
          )}

          {/* ── Separator (when no findings) ── */}
          {result.fixPlan.length === 0 && (
            <div className="border-t border-border" />
          )}

          {/* ── Summary cards ── */}
          <div className={`${inPad} py-6 sm:py-8 grid grid-cols-2 gap-3 sm:gap-4 border-t border-border`}>

            <div className="rounded-xl bg-surface-subtle px-4 py-4 min-h-[6rem] flex flex-col justify-between">
              <p className="text-[10px] text-ds-tertiary uppercase tracking-widest font-semibold">Colors</p>
              <div className="space-y-0.5 mt-auto">
                <p className="text-sm font-mono text-ds-primary">
                  <span className="font-semibold">{result.colorSprawl.uniqueCount}</span> unique
                </p>
                {result.colorSprawl.nearDuplicates.length > 0 && (
                  <p className="text-sm font-mono text-ds-amber">
                    <span className="font-semibold">{result.colorSprawl.nearDuplicates.length}</span> near-duplicate{result.colorSprawl.nearDuplicates.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-surface-subtle px-4 py-4 min-h-[6rem] flex flex-col justify-between">
              <p className="text-[10px] text-ds-tertiary uppercase tracking-widest font-semibold">Spacing</p>
              <div className="space-y-0.5 mt-auto">
                <p className="text-sm font-mono text-ds-primary">
                  base-<span className="font-semibold">{result.spacingSprawl.detectedBase}</span> grid
                </p>
                <p className="text-sm font-mono text-ds-primary">
                  <span className="font-semibold">{result.spacingSprawl.adherence}%</span> adherence
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-surface-subtle px-4 py-4 min-h-[6rem] flex flex-col justify-between">
              <p className="text-[10px] text-ds-tertiary uppercase tracking-widest font-semibold">Typography</p>
              <div className="space-y-0.5 mt-auto">
                <p className="text-sm font-mono text-ds-primary">
                  <span className="font-semibold">{result.typeSprawl.fontFamilies.length}</span> families
                </p>
                <p className="text-sm font-mono text-ds-primary">
                  <span className="font-semibold">{result.typeSprawl.fontSizes.length}</span> sizes
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-surface-subtle px-4 py-4 min-h-[6rem] flex flex-col justify-between">
              <p className="text-[10px] text-ds-tertiary uppercase tracking-widest font-semibold">Shape</p>
              <div className="space-y-0.5 mt-auto">
                <p className="text-sm font-mono text-ds-primary">
                  <span className="font-semibold">{result.miscSprawl.borderRadii.length}</span> radii
                </p>
                <p className="text-sm font-mono text-ds-primary">
                  <span className="font-semibold">{result.miscSprawl.boxShadows.length}</span> shadows
                </p>
              </div>
            </div>

          </div>

          {/* ── Analysis ── */}
          <div className={`${inPad} pb-5 sm:pb-8`}>

            {/* ── Sticky global search ── */}
            <div className="sticky z-40 -mx-5 sm:-mx-8 px-4 sm:px-7 pt-3 pb-2 bg-bg-card/95 backdrop-blur-sm border-b border-transparent"
              style={{
                top: expanded ? 0 : 45,
                borderColor: filterQuery ? 'var(--border)' : 'transparent',
              }}
            >
              <div className="relative">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ds-tertiary pointer-events-none"
                >
                  <circle cx="6" cy="6" r="4" />
                  <path d="M9 9l3 3" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Filter values, colors, tokens…"
                  className="w-full pl-8 pr-20 py-2 text-xs font-mono rounded-lg border border-border bg-bg-card text-ds-primary placeholder:text-ds-tertiary focus:outline-none focus:border-ds-olive transition-colors duration-150"
                />

                {/* Right side: clear button or ⌘F hint */}
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {filterQuery ? (
                    <button
                      onClick={() => { setFilterQuery(""); searchRef.current?.focus(); }}
                      className="text-ds-tertiary hover:text-ds-secondary transition-colors cursor-pointer"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M3 3l6 6M9 3l-6 6" />
                      </svg>
                    </button>
                  ) : !searchFocused ? (
                    /* Keyboard hint — hidden when focused or when there's text */
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono text-ds-tertiary bg-surface-subtle border border-border rounded px-1.5 py-0.5 leading-none select-none">
                      ⌘F
                    </kbd>
                  ) : (
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono text-ds-tertiary bg-surface-subtle border border-border rounded px-1.5 py-0.5 leading-none select-none">
                      esc
                    </kbd>
                  )}
                </span>
              </div>
            </div>

            {/* When a section label matches the query, children get
               an empty filterQuery so they show everything unfiltered.
               This lets you type "typography" to see the full typography section. */}
            {(() => {
              const q = filterQuery.toLowerCase().trim();
              const typoMatch = q && "typography".includes(q);
              const colorMatch = q && "colors".includes(q);
              const spacingMatch = q && "spacing & layout spacing layout".includes(q);
              const tokenMatch = q && "css variables".includes(q);
              /* Child query: pass "" when the parent section label matches */
              const typoQ = typoMatch ? "" : filterQuery;
              const colorQ = colorMatch ? "" : filterQuery;
              const spacingQ = spacingMatch ? "" : filterQuery;
              const tokenQ = tokenMatch ? "" : filterQuery;

              /* Compute match counts per section for the badge.
                 Mirrors the same filtering logic SprawlSection/ColorPalette use. */
              const countMatches = (vals: { value: string }[], childQ: string, title?: string) => {
                if (!q) return 0;
                if (!childQ) return vals.length; // section label matched → all shown
                const cq = childQ.toLowerCase().trim();
                const titleHit = title && title.toLowerCase().includes(cq);
                return titleHit ? vals.length : vals.filter(v => v.value.toLowerCase().includes(cq)).length;
              };

              const typoCount = q ? (
                countMatches(result.typeSprawl.fontSizes, typoQ, "Font Sizes") +
                countMatches(result.typeSprawl.fontWeights, typoQ, "Font Weights") +
                countMatches(result.typeSprawl.fontFamilies, typoQ, "Font Families") +
                countMatches(result.typeSprawl.lineHeights, typoQ, "Line Heights")
              ) : undefined;

              const colorCount = q ? (
                colorQ ? result.colorSprawl.hueGroups.reduce((sum, g) =>
                  sum + g.colors.filter(c =>
                    c.hex.toLowerCase().includes(colorQ.toLowerCase()) ||
                    c.name.toLowerCase().includes(colorQ.toLowerCase()) ||
                    g.name.toLowerCase().includes(colorQ.toLowerCase())
                  ).length, 0
                ) : result.colorSprawl.allColors.length
              ) : undefined;

              const spacingCount = q ? (
                countMatches(result.spacingSprawl.allValues, spacingQ, "Spacing") +
                countMatches(result.miscSprawl.borderRadii, spacingQ, "Border Radii") +
                countMatches(result.miscSprawl.boxShadows, spacingQ, "Box Shadows") +
                countMatches(result.miscSprawl.zIndices, spacingQ, "z-index") +
                countMatches(result.miscSprawl.opacities, spacingQ, "Opacity") +
                countMatches(result.miscSprawl.transitions, spacingQ, "Transitions")
              ) : undefined;

              return (
                <>
                  {/* ── Typography ── */}
                  <SectionGroup
                    label="Typography"
                    detail={`${result.typeSprawl.fontFamilies.length} families · ${result.typeSprawl.fontSizes.length} sizes · ${result.typeSprawl.fontWeights.length} weights`}
                    first
                    forceOpen={!!filterQuery}
                    filterQuery={filterQuery}
                    matchCount={typoCount}
                    stickyTop={expanded ? 55 : 100}
                  >
                    {!typoQ && (
                      <>
                        <TypePaletteView
                          styles={result.textStyles}
                          fontFaces={result.fontFaces}
                        />
                        <TypeScaleView data={result.typeScale} />
                      </>
                    )}

                    <SprawlSection title="Font Sizes" score={scoreFor("Font Sizes")} values={result.typeSprawl.fontSizes} sortable filterQuery={typoQ}>
                      {result.typeSprawl.sizeNearDuplicates.length > 0 && !typoQ && (
                        <div className="mt-3">
                          <p className="text-xs text-ds-amber font-medium mb-1.5">Near-duplicate sizes</p>
                          {result.typeSprawl.sizeNearDuplicates.map((nd, i) => (
                            <p key={i} className="text-xs font-mono text-ds-secondary">
                              {nd.value1} ≈ {nd.value2} <span className="text-ds-tertiary">(Δ{nd.difference}px)</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </SprawlSection>

                    <SprawlSection title="Font Weights" score={scoreFor("Font Weights")} values={result.typeSprawl.fontWeights} filterQuery={typoQ} />
                    <SprawlSection title="Font Families" score={scoreFor("Font Families")} values={result.typeSprawl.fontFamilies} filterQuery={typoQ} />

                    <SprawlSection title="Line Heights" score={scoreFor("Line Heights")} values={result.typeSprawl.lineHeights} sortable filterQuery={typoQ}>
                      {result.typeSprawl.lineHeightRatios.length > 0 && !typoQ && (
                        <div className="mt-3">
                          <p className="text-xs text-ds-tertiary mb-2">Detected ratios (line-height ÷ font-size)</p>
                          <div className="flex gap-2 flex-wrap">
                            {result.typeSprawl.lineHeightRatios.map((r) => (
                              <span key={r.value} className="text-xs font-mono px-2.5 py-1 rounded-md bg-ds-olive-50 text-ds-secondary border border-ds-olive-100/60">
                                {r.value}× <span className="text-ds-tertiary">({r.count})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </SprawlSection>
                  </SectionGroup>

                  {/* ── Colors ── */}
                  <SectionGroup
                    label="Colors"
                    detail={`${result.colorSprawl.uniqueCount} unique · ${result.colorSprawl.hueGroups.length} hue groups`}
                    forceOpen={!!filterQuery}
                    filterQuery={filterQuery}
                    matchCount={colorCount}
                    stickyTop={expanded ? 55 : 100}
                  >
                    {!colorQ && <ColorRolesView data={result.colorRoles} />}
                    <ColorPalette data={result.colorSprawl} score={scoreFor("Colors")} filterQuery={colorQ} />
                  </SectionGroup>

                  {/* ── Spacing & Layout ── */}
                  <SectionGroup
                    label="Spacing & Layout"
                    detail={`base-${result.spacingSprawl.detectedBase} grid · ${result.spacingSprawl.adherence}% adherence`}
                    forceOpen={!!filterQuery}
                    filterQuery={filterQuery}
                    matchCount={spacingCount}
                    stickyTop={expanded ? 55 : 100}
                  >
                    <SprawlSection title="Spacing" score={scoreFor("Spacing")} values={result.spacingSprawl.allValues} flagged={offGridSet} sortable filterQuery={spacingQ}>
                      {!spacingQ && (
                        <div className="mt-3 text-xs text-ds-tertiary">
                          Detected: base-{result.spacingSprawl.detectedBase} grid · {result.spacingSprawl.adherence}% adherence
                          {result.spacingSprawl.layoutValues.length > 0 && (
                            <> · {result.spacingSprawl.layoutValues.length} layout values excluded (&gt;96px)</>
                          )}
                        </div>
                      )}
                      {result.spacingSprawl.offGrid.length > 0 && !spacingQ && (
                        <div className="mt-3">
                          <p className="text-xs text-ds-amber font-medium mb-1.5">Off-grid values ({result.spacingSprawl.offGrid.length})</p>
                          <div className="space-y-0.5">
                            {[...result.spacingSprawl.offGrid].sort((a, b) => b.count - a.count).map((v) => (
                              <p key={v.value} className="text-xs font-mono text-ds-secondary">
                                {v.value} <span className="text-ds-tertiary">×{v.count}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </SprawlSection>

                    <SprawlSection title="Border Radii" score={scoreFor("Border Radii")} values={result.miscSprawl.borderRadii} sortable filterQuery={spacingQ} />
                    <SprawlSection title="Box Shadows" score={scoreFor("Box Shadows")} values={result.miscSprawl.boxShadows} filterQuery={spacingQ} />
                    <SprawlSection title="z-index" score={scoreFor("z-index")} values={result.miscSprawl.zIndices} sortable filterQuery={spacingQ} />

                    {result.miscSprawl.opacities.length > 0 && (
                      <SprawlSection title="Opacity" values={result.miscSprawl.opacities} filterQuery={spacingQ} />
                    )}
                    {result.miscSprawl.transitions.length > 0 && (
                      <SprawlSection title="Transitions" values={result.miscSprawl.transitions} filterQuery={spacingQ} />
                    )}
                  </SectionGroup>

                  {/* ── CSS Variables (always rendered — has empty state) ── */}
                  <SectionGroup
                    label="CSS Variables"
                    detail={
                      result.designTokens.totalCount === 0
                        ? "none found"
                        : `${result.designTokens.totalCount} in ${result.designTokens.groups.length} ${result.designTokens.groups.length === 1 ? "category" : "categories"}`
                    }
                    forceOpen={!!filterQuery}
                    filterQuery={filterQuery}
                    matchCount={q ? countTokenMatches(result.designTokens, tokenQ || filterQuery) : undefined}
                    stickyTop={expanded ? 55 : 100}
                  >
                    <DesignTokensView
                      data={result.designTokens}
                      filterQuery={tokenQ}
                    />
                  </SectionGroup>

                  {/* ── Component Patterns ── */}
                  {result.patterns.patterns.length > 0 && (
                    <SectionGroup
                      label="Component Patterns"
                      detail={`${result.patterns.patterns.length} patterns · ${result.patterns.coverage}% coverage`}
                      defaultOpen={false}
                      forceOpen={!!filterQuery}
                      filterQuery={filterQuery}
                      stickyTop={expanded ? 55 : 100}
                    >
                      <PatternsView data={result.patterns} />
                    </SectionGroup>
                  )}
                </>
              );
            })()}
          </div>
          </>
        );

        /* ── Fullscreen modal ── */
        if (expanded) {
          const exiting = modalClosing || modalMinimizing;
          return createPortal(
            <div className="fixed inset-0 z-[9999]">
              <div
                className={`absolute inset-0 bg-black/30 backdrop-blur-md ${
                  exiting ? "animate-modal-backdrop-out" : "animate-modal-backdrop"
                }`}
                onClick={modalMinimizing ? undefined : collapseModal}
              />
              <div
                className={`absolute inset-3 sm:inset-5 lg:inset-8 rounded-2xl border border-border bg-bg-card shadow-2xl flex flex-col overflow-hidden ${
                  modalMinimizing
                    ? "animate-modal-minimize"
                    : modalClosing
                      ? "animate-modal-collapse"
                      : "animate-modal-expand"
                }`}
                style={{ clipPath: "inset(0 round 1rem)" }}
              >
                <div className={`flex flex-col flex-1 min-h-0 ${
                  exiting ? "animate-modal-content-out" : "animate-modal-content-in"
                }`}>
                  {chrome}
                  <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    {cardBody}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          );
        }

        /* ── Minimized: quote + dock chip ── */
        if (minimized) {
          return (
            <>
              {/* The quote — centered where the card was */}
              <div className={`flex flex-col items-center justify-center py-20 sm:py-28 select-none ${
                dockExiting ? "animate-quote-out" : ""
              }`}>
                {/* Decorative line */}
                <div
                  className="w-12 h-px bg-ds-olive/30 mb-8 animate-quote-line origin-center"
                />
                {/* Quote text — GSAP SplitText word reveal */}
                <blockquote className="text-center max-w-md sm:max-w-lg px-4">
                  <TextReveal
                    type="words"
                    duration={0.9}
                    stagger={0.06}
                    ease="expo.out"
                    yPercent={110}
                    start="top 95%"
                    className="text-2xl sm:text-3xl md:text-4xl font-serif leading-snug text-ds-primary/90 tracking-tight"
                  >
                    <span className="block">&ldquo;The details are not the details.</span>
                    <span className="block">They make the design.&rdquo;</span>
                  </TextReveal>
                </blockquote>
                {/* Attribution */}
                <p className="animate-quote-attr mt-6 text-sm font-mono text-ds-tertiary tracking-wide">
                  — Charles Eames
                </p>
              </div>

              {/* Dock chip — fixed at bottom center */}
              {(() => {
                const s = result.scores.overall;
                const dockStroke = s >= 90 ? "var(--green)" : s >= 75 ? "var(--blue)" : s >= 55 ? "var(--amber)" : "var(--red)";
                const dockText = s >= 90 ? "text-ds-green" : s >= 75 ? "text-ds-blue" : s >= 55 ? "text-ds-amber" : "text-ds-red";
                return (
              <div
                className={`fixed bottom-6 left-1/2 z-50 cursor-pointer group ${
                  dockExiting ? "animate-dock-out" : "animate-dock-in"
                }`}
                onClick={restoreCard}
              >
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-border bg-bg-card/95 backdrop-blur-md shadow-lg transition-all duration-200 group-hover:shadow-xl group-hover:border-ds-olive/30 group-active:scale-[0.97] group-active:duration-75">
                  {/* Tiny score ring */}
                  <div className="relative w-7 h-7 shrink-0">
                    <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
                      <circle cx="36" cy="36" r="28" fill="none" stroke="var(--border)" strokeWidth="4" opacity="0.3" />
                      <circle
                        cx="36" cy="36" r="28" fill="none" stroke={dockStroke} strokeWidth="4"
                        strokeDasharray={2 * Math.PI * 28}
                        strokeDashoffset={2 * Math.PI * 28 - (result.scores.overall / 100) * 2 * Math.PI * 28}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-serif font-bold ${dockText}`}>
                      {result.scores.grade}
                    </span>
                  </div>
                  {/* URL */}
                  <span className="text-xs font-mono text-ds-secondary truncate max-w-[160px] sm:max-w-[220px]">
                    {result.url.replace(/^https?:\/\//, "")}
                  </span>
                  {/* Restore hint */}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-ds-tertiary group-hover:text-ds-olive transition-colors shrink-0">
                    <path d="M2 7L5 3L8 7" />
                  </svg>
                </div>
              </div>
                );
              })()}
            </>
          );
        }

        /* ── Normal inline card (with minimize/restore animations) ── */
        const isFirstEntrance = !wasRestored.current && !minimizing && !restoring;
        return (
          <div
            className={`rounded-2xl border border-border shadow-sm bg-bg-card ${
              minimizing
                ? "animate-minimize"
                : restoring
                  ? "animate-restore-shell"
                  : wasRestored.current
                    ? ""
                    : "animate-results-shell"
            }`}
            style={{
              clipPath: "inset(0 round 1rem)",
              transformOrigin: "center top",
            }}
          >
            <div className={
              restoring
                ? "animate-restore-content"
                : isFirstEntrance
                  ? "animate-results-content"
                  : undefined
            }>
              {chrome}
              {cardBody}
            </div>
          </div>
        );
      })()}

        </div>{/* end swapInnerRef */}
      </div>{/* end height-transition wrapper */}

      <footer data-enter="footer" className={`mt-12 sm:mt-16 pt-5 sm:pt-6 border-t border-border space-y-2 transition-opacity duration-300 ${minimized || minimizing || restoring ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <p className="text-xs text-ds-tertiary leading-relaxed">
          Your design system has opinions. This tool just makes them visible.
        </p>
        <div className="flex items-center justify-between gap-4">
          <p className="text-[10px] text-ds-tertiary/50 leading-relaxed font-mono">
            Fun fact: the average website ships 37 unique font sizes. The ones that feel&nbsp;good? Usually&nbsp;six.
          </p>
          {/* <a
            href="https://www.linkedin.com/in/florian-gampert/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Florian Gampert on LinkedIn"
            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-ds-tertiary/40 hover:text-[#0A66C2] hover:bg-[#0A66C2]/10 active:scale-95 transition-all duration-150 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a> */}
        </div>
      </footer>
    </div>
  );
}
