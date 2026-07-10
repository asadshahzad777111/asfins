"use client";

import { useEffect, useSyncExternalStore } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { usePathname } from "next/navigation";

function subscribePointer(cb: () => void) {
  const mq = window.matchMedia("(pointer: fine)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  reduced.addEventListener("change", cb);
  return () => {
    mq.removeEventListener("change", cb);
    reduced.removeEventListener("change", cb);
  };
}

function getPointerSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Subtle ink follower — desktop only; disabled on touch & canvas routes. */
export function CustomCursor() {
  const pathname = usePathname();
  const finePointer = useSyncExternalStore(
    subscribePointer,
    getPointerSnapshot,
    () => false
  );

  const skip =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/configurator") ||
    pathname.startsWith("/studio/kitchen");

  const enabled = finePointer && !skip;

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 380, damping: 32, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 380, damping: 32, mass: 0.4 });

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove("has-custom-cursor");
      return;
    }

    document.documentElement.classList.add("has-custom-cursor");
    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] mix-blend-difference"
      style={{
        x: sx,
        y: sy,
        translateX: "-50%",
        translateY: "-50%",
      }}
    >
      <div className="h-3 w-3 rounded-full bg-paper" />
    </motion.div>
  );
}
