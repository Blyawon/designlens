"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { AuditResult, CategoryScore } from "@/lib/audit/types";
import ScoreRing from "./ScoreRing";
import FixPlanDisplay from "./FixPlanDisplay";
import ColorRolesView from "./ColorRolesView";
import TypeScaleView from "./TypeScaleView";
import TypePaletteView from "./TypePaletteView";
import ColorPalette from "./ColorPalette";
import SprawlSection from "./SprawlSection";

type Status = "idle" | "running" | "done" | "error";

/* Client-side timeout for the entire audit request.
   If the server hasn't finished in 55s, we abort gracefully
   (server-side maxDuration is 60s, so 55s avoids a silent drop). */
const CLIENT_TIMEOUT_MS = 55_000;

/* ---- Typewriter ---- */

const ROTATE_WORDS = [
  "design system.",
  "color palette.",
  "type scale.",
  "spacing grid.",
  "visual tokens.",
];

function Typewriter() {
  const [wordIdx, setWordIdx] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const pauseRef = useRef(false);

  useEffect(() => {
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
  }, [text, deleting, wordIdx]);

  return (
    <span className="text-ds-olive">
      {text}
      <span
        className="inline-block w-[3px] h-[0.85em] bg-ds-olive/70 ml-0.5 align-baseline relative top-[0.05em]"
        style={{ animation: "blink 1s step-end infinite" }}
      />
    </span>
  );
}

/* ---- Example URLs ---- */

const EXAMPLES = ["stripe.com", "linear.app", "vercel.com"];

/* ---- Browser chrome ---- */

function BrowserChrome({ url, ghost }: { url: string; ghost?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 border-b ${
        ghost
          ? "border-border/30 bg-bg-card/30"
          : "border-border/40 bg-[var(--bg-elevated)]"
      }`}
    >
      <div className="flex gap-1.5 shrink-0">
        <div className="w-2 h-2 rounded-full bg-[var(--surface-dots)]" />
        <div className="w-2 h-2 rounded-full bg-[var(--surface-dots)]" />
        <div className="w-2 h-2 rounded-full bg-[var(--surface-dots)]" />
      </div>
      <div className="flex-1 flex justify-center min-w-0">
        <div
          className={`px-3 py-0.5 rounded-md bg-[var(--surface-url)] text-[11px] font-mono truncate max-w-[220px] sm:max-w-sm ${
            ghost ? "text-ds-tertiary/50" : "text-ds-tertiary"
          }`}
        >
          {url}
        </div>
      </div>
      <div className="w-8 sm:w-10 shrink-0" />
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
              <div className="flex-1 h-4 bg-[var(--surface-subtle)] rounded-sm overflow-hidden">
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

function GroupHeader({ label, detail, first }: { label: string; detail?: string; first?: boolean }) {
  return (
    <div className={`${first ? "pt-5 sm:pt-6" : "pt-8 sm:pt-10"} pb-1 flex items-baseline gap-3`}>
      <span className="text-xs font-semibold uppercase tracking-widest text-ds-olive">
        {label}
      </span>
      {detail && (
        <span className="text-[11px] text-ds-tertiary font-mono">
          {detail}
        </span>
      )}
    </div>
  );
}

/* ── Stepped progress ── */

const STEPS = [
  { id: "connect", label: "Connecting to page", phases: ["launching", "loading", "waiting"] },
  { id: "sample", label: "Sampling DOM elements", phases: ["sampling", "sampled", "fonts", "screenshot"] },
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
          <div key={step.id} className="flex items-center gap-3">
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

  /* Bumps on every new error to re-trigger the shake animation. */
  const [errorKey, setErrorKey] = useState(0);
  const showError = useCallback((msg: string) => {
    setError(msg);
    setErrorKey((k) => k + 1);
  }, []);

  /* ── Button animation system ── */
  const btnRef = useRef<HTMLButtonElement>(null);

  /* Squeeze-bounce on Analyze click via Web Animations API */
  const pressAnalyze = useCallback(() => {
    btnRef.current?.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(0.92)", offset: 0.2 },
        { transform: "scale(1.05)", offset: 0.55 },
        { transform: "scale(0.98)", offset: 0.8 },
        { transform: "scale(1)" },
      ],
      { duration: 350, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
    );
  }, []);

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
      setStatus("idle");
      setProgress("");
    }, 200);
  }, []);

  /* Clean up on unmount (e.g. user navigates away) */
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const run = useCallback(
    async (overrideUrl?: string) => {
      const targetUrl = (overrideUrl || url).trim();
      if (!targetUrl) return;

      /* Cancel any in-flight request first */
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      if (overrideUrl) setUrl(overrideUrl);
      pressAnalyze();
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
    [url, pressAnalyze, showError]
  );

  const scoreFor = (name: string): CategoryScore | undefined =>
    result?.scores.categories.find((c) => c.name === name);

  const offGridSet = result
    ? new Set(result.spacingSprawl.offGrid.map((v) => v.value))
    : new Set<string>();

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/report/${result.id}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* Consistent inner padding for the browser window */
  const inPad = "px-5 sm:px-8";

  return (
    <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* ── Animated gradient orbs (outside overflow clip) ── */}
      <div
        className="pointer-events-none fixed top-0 left-0 w-[420px] sm:w-[520px] h-[420px] sm:h-[520px] rounded-full opacity-[0.18]"
        style={{
          backgroundColor: colors.primary,
          filter: "blur(90px)",
          transition: "background-color 2s ease",
          animation: "drift 25s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none fixed bottom-0 right-0 w-[300px] sm:w-[380px] h-[300px] sm:h-[380px] rounded-full opacity-[0.12]"
        style={{
          backgroundColor: colors.secondary,
          filter: "blur(90px)",
          transition: "background-color 2s ease",
          animation: "drift2 30s ease-in-out infinite",
        }}
      />

      {/* ── Hero ── */}
      <header className="relative mb-10 sm:mb-14">
        <div className="flex items-center gap-2 mb-4 sm:mb-5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-ds-olive"
            style={{ animation: "pulse-dot 2.5s ease-in-out infinite" }}
          />
          <span className="text-xs sm:text-sm font-medium text-ds-olive tracking-wide">
            Visual design system analysis
          </span>
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif tracking-tight text-ds-primary leading-[0.95]">
          Diagnose your
          <br />
          <Typewriter />
        </h1>
        <p className="text-base sm:text-lg text-ds-secondary mt-5 sm:mt-6 max-w-lg leading-relaxed">
          Paste any URL and get an instant diagnostic on visual consistency
          — colors, spacing, typography, and layout tokens.
        </p>
      </header>

      {/* ── Input ── */}
      <div className="relative mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            disabled={status === "running"}
            className="w-full sm:flex-1 h-13 sm:h-14 px-4 sm:px-5 rounded-xl bg-bg-card border border-border text-base font-mono text-ds-primary placeholder:text-ds-tertiary focus:outline-none focus:border-ds-olive focus:ring-2 focus:ring-ds-olive/20 disabled:opacity-50 transition-colors shadow-sm"
          />
          {/* ── Action button ── */}
          <div className="relative shrink-0 group" style={{ minWidth: "7.5rem" }}>
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
        <span className="text-xs text-ds-tertiary">Try</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => run(`https://${ex}`)}
            disabled={status === "running"}
            className="text-xs font-mono px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-bg-card/70 border border-border text-ds-secondary hover:border-ds-olive/50 hover:text-ds-olive cursor-pointer transition-all disabled:opacity-40 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* ── Ghost (idle) ── */}
      {status === "idle" && <GhostPreview />}

      {/* ── Progress ── */}
      {status === "running" && (
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
      {result && status === "done" && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm bg-bg-card animate-fade-up">
          <BrowserChrome url={result.url} />

          {/* ── Score ── */}
          <div className={`${inPad} py-8 sm:py-10`}>
            <div className="flex flex-col items-center">
              <ScoreRing
                score={result.scores.overall}
                grade={result.scores.grade}
                label="Design Consistency"
              />
              <div className="flex items-center gap-2 mt-4 text-xs flex-wrap justify-center">
                <span className={`font-mono font-medium ${confColor[result.scores.confidence]}`}>
                  {result.scores.confidence} confidence
                </span>
                <span className="text-ds-tertiary">·</span>
                <span className="text-ds-tertiary font-mono">
                  {result.elementCount} elements
                </span>
                <span className="text-ds-tertiary">·</span>
                <button
                  onClick={handleCopy}
                  className="text-ds-olive font-medium hover:text-ds-olive/70 cursor-pointer transition-colors"
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-border">
              {result.scores.categories.slice(0, 5).map((c, i) => (
                <div
                  key={c.name}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg border animate-fade-up ${gradePillBg[c.grade]}`}
                  style={{ animationDelay: `${0.8 + i * 0.07}s` }}
                >
                  <span className="text-xs text-ds-secondary">{c.name}</span>
                  <span className={`text-xs sm:text-sm font-bold font-mono ${gradeColor[c.grade]}`}>
                    {c.grade}
                  </span>
                </div>
              ))}
            </div>
          </div>

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
          <div className={`${inPad} py-5 sm:py-6 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border`}>
            <div className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2.5">
              <p className="text-[11px] text-ds-tertiary uppercase tracking-wider mb-0.5">Colors</p>
              <p className="text-sm font-mono text-ds-primary font-medium">
                {result.colorSprawl.uniqueCount}
                {result.colorSprawl.nearDuplicates.length > 0 && (
                  <span className="text-ds-amber font-normal"> · {result.colorSprawl.nearDuplicates.length} dupes</span>
                )}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2.5">
              <p className="text-[11px] text-ds-tertiary uppercase tracking-wider mb-0.5">Spacing</p>
              <p className="text-sm font-mono text-ds-primary font-medium">
                base-{result.spacingSprawl.detectedBase} · {result.spacingSprawl.adherence}%
              </p>
            </div>
            <div className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2.5">
              <p className="text-[11px] text-ds-tertiary uppercase tracking-wider mb-0.5">Typography</p>
              <p className="text-sm font-mono text-ds-primary font-medium">
                {result.typeSprawl.fontFamilies.length} families · {result.typeSprawl.fontSizes.length} sizes
              </p>
            </div>
            <div className="rounded-lg bg-[var(--surface-subtle)] px-3 py-2.5">
              <p className="text-[11px] text-ds-tertiary uppercase tracking-wider mb-0.5">Shape</p>
              <p className="text-sm font-mono text-ds-primary font-medium">
                {result.miscSprawl.borderRadii.length} radii · {result.miscSprawl.boxShadows.length} shadows
              </p>
            </div>
          </div>

          {/* ── Analysis ── */}
          <div className={`${inPad} pb-5 sm:pb-6`}>
            <GroupHeader
              label="Typography"
              detail={`${result.typeSprawl.fontFamilies.length} families · ${result.typeSprawl.fontSizes.length} sizes · ${result.typeSprawl.fontWeights.length} weights`}
              first
            />

            <TypePaletteView
              styles={result.textStyles}
              fontFaces={result.fontFaces}
            />
            <TypeScaleView data={result.typeScale} />

            <SprawlSection title="Font Sizes" score={scoreFor("Font Sizes")} values={result.typeSprawl.fontSizes} sortable>
              {result.typeSprawl.sizeNearDuplicates.length > 0 && (
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

            <SprawlSection title="Font Weights" score={scoreFor("Font Weights")} values={result.typeSprawl.fontWeights} />
            <SprawlSection title="Font Families" score={scoreFor("Font Families")} values={result.typeSprawl.fontFamilies} />

            <SprawlSection title="Line Heights" score={scoreFor("Line Heights")} values={result.typeSprawl.lineHeights} sortable>
              {result.typeSprawl.lineHeightRatios.length > 0 && (
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

            <GroupHeader
              label="Colors"
              detail={`${result.colorSprawl.uniqueCount} unique · ${result.colorSprawl.hueGroups.length} hue groups`}
            />
            <ColorRolesView data={result.colorRoles} />
            <ColorPalette data={result.colorSprawl} score={scoreFor("Colors")} defaultOpen />

            <GroupHeader
              label="Spacing & Layout"
              detail={`base-${result.spacingSprawl.detectedBase} grid · ${result.spacingSprawl.adherence}% adherence`}
            />

            <SprawlSection title="Spacing" score={scoreFor("Spacing")} values={result.spacingSprawl.allValues} flagged={offGridSet} sortable defaultOpen>
              <div className="mt-3 text-xs text-ds-tertiary">
                Detected: base-{result.spacingSprawl.detectedBase} grid · {result.spacingSprawl.adherence}% adherence
                {result.spacingSprawl.layoutValues.length > 0 && (
                  <> · {result.spacingSprawl.layoutValues.length} layout values excluded (&gt;96px)</>
                )}
              </div>
              {result.spacingSprawl.offGrid.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-ds-amber font-medium mb-1.5">Off-grid values ({result.spacingSprawl.offGrid.length})</p>
                  <div className="space-y-0.5">
                    {result.spacingSprawl.offGrid.sort((a, b) => b.count - a.count).map((v) => (
                      <p key={v.value} className="text-xs font-mono text-ds-secondary">
                        {v.value} <span className="text-ds-tertiary">×{v.count}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </SprawlSection>

            <SprawlSection title="Border Radii" score={scoreFor("Border Radii")} values={result.miscSprawl.borderRadii} sortable />
            <SprawlSection title="Box Shadows" score={scoreFor("Box Shadows")} values={result.miscSprawl.boxShadows} />
            <SprawlSection title="z-index" score={scoreFor("z-index")} values={result.miscSprawl.zIndices} sortable />

            {result.miscSprawl.opacities.length > 0 && (
              <SprawlSection title="Opacity" values={result.miscSprawl.opacities} />
            )}
            {result.miscSprawl.transitions.length > 0 && (
              <SprawlSection title="Transitions" values={result.miscSprawl.transitions} />
            )}
          </div>
        </div>
      )}

      <footer className="mt-16 sm:mt-20 pt-6 border-t border-border">
        <p className="text-xs text-ds-tertiary leading-relaxed">
          Your design system has opinions. This tool just makes them visible.
        </p>
      </footer>
    </div>
  );
}
