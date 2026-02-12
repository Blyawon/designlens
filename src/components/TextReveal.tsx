'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import './text-reveal.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
}

/**
 * TextReveal Component
 * Professional text reveal animation using GSAP SplitText with line masking.
 * Text slides up from behind masks as you scroll (or on mount if already in view),
 * creating a clean, editorial reveal effect.
 */

interface TextRevealProps {
  className?: string;
  children: ReactNode;
  type?: 'lines' | 'words' | 'chars';
  start?: string;
  end?: string;
  scrub?: boolean | number;
  duration?: number;
  stagger?: number;
  ease?: string;
  yPercent?: number;
  markers?: boolean;
  onComplete?: () => void;
}

export default function TextReveal({
  className = '',
  children,
  type = 'words',
  start = 'top 80%',
  end = '',
  scrub = false,
  duration = 0.8,
  stagger = 0.08,
  ease = 'expo.out',
  yPercent = 110,
  markers = false,
  onComplete,
}: TextRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<SplitText | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Wait for fonts before SplitText
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.fonts.ready.then(() => setFontsLoaded(true));
    }
  }, []);

  useGSAP(
    () => {
      if (!fontsLoaded || !textRef.current) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      // Determine split types
      const typesToSplit =
        type === 'lines'
          ? 'lines'
          : type === 'words'
            ? 'lines,words'
            : 'lines,words,chars';

      // Split text with masking
      splitRef.current = new SplitText(textRef.current, {
        type: typesToSplit,
        linesClass: 'split-line',
        wordsClass: 'split-word',
        charsClass: 'split-char',
      });

      // Get animation targets based on type
      const targets = splitRef.current[type];

      // CRITICAL: Set initial position BEFORE making visible to prevent FOUC
      gsap.set(targets, {
        yPercent,
        force3D: true,
        willChange: 'transform',
      });
      gsap.set(textRef.current, { autoAlpha: 1 });

      // Parse scrub value
      const scrubValue =
        scrub === true
          ? true
          : typeof scrub === 'number'
            ? scrub
            : false;

      // Animate text reveal
      gsap.to(targets, {
        yPercent: 0,
        duration,
        stagger,
        ease,
        force3D: true,
        scrollTrigger: {
          trigger: containerRef.current,
          start,
          end: end || undefined,
          scrub: scrubValue,
          once: !scrubValue,
          markers,
        },
        onComplete: () => {
          // Clear willChange after animation
          gsap.set(targets, { willChange: 'auto' });
          onComplete?.();
        },
      });

      // Cleanup
      return () => {
        if (splitRef.current) {
          splitRef.current.revert();
        }
        ScrollTrigger.getAll().forEach((st) => st.kill());
        if (targets) {
          gsap.killTweensOf(targets);
        }
      };
    },
    {
      scope: containerRef,
      dependencies: [fontsLoaded, type, start, end, scrub, duration, stagger, ease, yPercent, markers],
    }
  );

  return (
    <div ref={containerRef} className={`text_reveal_wrap ${className}`.trim()}>
      <div
        ref={textRef}
        data-anm-scroll-text-reveal
        className="text_reveal_text"
        style={{ visibility: 'hidden' }}
      >
        {children}
      </div>
    </div>
  );
}
