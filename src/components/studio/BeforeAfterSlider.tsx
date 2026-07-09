"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  hint?: string;
  className?: string;
  /** Gentle auto-sweep when idle (top-site engagement pattern) */
  autoPlay?: boolean;
}

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "After",
  hint = "DRAG TO COMPARE",
  className = "",
  autoPlay = true,
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(28);
  const [dragging, setDragging] = useState(false);
  const [userTouched, setUserTouched] = useState(false);
  const rafRef = useRef<number | null>(null);
  const dirRef = useRef(1);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(98, Math.max(2, pct)));
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      updatePosition(x);
    };
    const onUp = () => setDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, updatePosition]);

  useEffect(() => {
    if (!autoPlay || userTouched || dragging) return;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      setPosition((p) => {
        let next = p + dirRef.current * dt * 0.012;
        if (next >= 72) {
          next = 72;
          dirRef.current = -1;
        } else if (next <= 28) {
          next = 28;
          dirRef.current = 1;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [autoPlay, userTouched, dragging]);

  const beginDrag = () => {
    setUserTouched(true);
    setDragging(true);
  };

  return (
    <div
      ref={containerRef}
      className={`before-after-slider relative select-none overflow-hidden ${className}`}
      onClick={(e) => {
        setUserTouched(true);
        updatePosition(e.clientX);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterSrc}
        alt={afterLabel}
        className="block h-full w-full object-cover"
        draggable={false}
        loading="eager"
        decoding="async"
      />

      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="block h-full w-full object-cover"
          draggable={false}
          loading="eager"
          decoding="async"
        />
      </div>

      <div
        className="absolute inset-y-0 z-10 w-0.5 cursor-ew-resize bg-white shadow-[0_0_24px_rgba(255,255,255,0.45)]"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
        onMouseDown={(e) => {
          e.stopPropagation();
          beginDrag();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          beginDrag();
        }}
      >
        <div
          className={`absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-walnut/85 shadow-xl backdrop-blur-sm transition-transform ${
            dragging ? "scale-110" : "scale-100"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M5 4L2 8L5 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M11 4L14 8L11 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <span className="absolute left-4 top-4 z-20 bg-walnut/80 px-3 py-1.5 font-mono-data text-[10px] uppercase tracking-wider text-marble backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="absolute right-4 top-4 z-20 bg-brass px-3 py-1.5 font-mono-data text-[10px] uppercase tracking-wider text-ink backdrop-blur-sm">
        {afterLabel}
      </span>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: dragging || userTouched ? 0 : 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 bg-black/55 px-4 py-1.5 font-mono-data text-[10px] uppercase tracking-[0.22em] text-white/85 backdrop-blur-sm"
      >
        {hint}
      </motion.p>
    </div>
  );
}
