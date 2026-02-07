"use client";

import { useState, useEffect } from "react";

interface Props {
  score: number;
  grade: string;
  size?: "lg" | "sm";
  label?: string;
}

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScoreRing({
  score,
  grade,
  size = "lg",
  label,
}: Props) {
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      setTimeout(() => setFilled(true), 80);
    });
    return () => cancelAnimationFrame(t);
  }, []);

  const strokeColor =
    score >= 90
      ? "var(--green)"
      : score >= 75
        ? "var(--blue)"
        : score >= 55
          ? "var(--amber)"
          : "var(--red)";

  const textColor =
    score >= 90
      ? "text-ds-green"
      : score >= 75
        ? "text-ds-blue"
        : score >= 55
          ? "text-ds-amber"
          : "text-ds-red";

  if (size === "sm") {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`text-lg font-bold font-mono ${textColor}`}>
          {grade}
        </span>
        <span className="text-xs text-ds-tertiary font-mono">{score}</span>
      </div>
    );
  }

  const targetOffset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
  const currentOffset = filled ? targetOffset : CIRCUMFERENCE;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth="6"
          />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={strokeColor}
            strokeWidth="6"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={currentOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-5xl font-serif"
            style={{
              color: strokeColor,
              opacity: filled ? 1 : 0,
              transition: "opacity 0.4s ease 0.5s",
            }}
          >
            {grade}
          </span>
        </div>
      </div>
      <div
        className="flex items-baseline gap-1.5"
        style={{
          opacity: filled ? 1 : 0,
          transform: filled ? "translateY(0)" : "translateY(6px)",
          transition: "all 0.4s ease 0.7s",
        }}
      >
        <span className="text-3xl font-mono font-semibold text-ds-primary">
          {score}
        </span>
        <span className="text-base text-ds-tertiary">/100</span>
      </div>
      {label && (
        <span
          className="text-sm text-ds-tertiary"
          style={{
            opacity: filled ? 1 : 0,
            transition: "opacity 0.4s ease 0.9s",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
