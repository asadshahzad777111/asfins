"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

interface RevealProps extends HTMLMotionProps<"div"> {
  delay?: number;
  y?: number;
  once?: boolean;
}

/** Scroll-triggered fade/rise — Locomotive-style editorial reveal. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  once = true,
  className,
  ...rest
}: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-8% 0px" }}
      transition={{ duration: 0.85, delay, ease }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface SplitLineProps {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "p" | "span";
}

/** Staggered line reveal for display headlines. */
export function SplitLines({
  text,
  className,
  delay = 0,
  as: Tag = "h1",
}: SplitLineProps) {
  const lines = text.split("\n");

  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden">
          <motion.span
            className="block"
            initial={{ y: "110%" }}
            whileInView={{ y: "0%" }}
            viewport={{ once: true, margin: "-5% 0px" }}
            transition={{ duration: 0.9, delay: delay + i * 0.12, ease }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
