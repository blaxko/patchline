"use client";

import type { CSSProperties } from "react";
import { motion, type Variants } from "framer-motion";
import { usePrefersReducedMotion } from "../../lib/usePrefersReducedMotion";

const riseVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Genuine scroll-triggered reveal (Section 4 of the follow-up brief: "as
 * each section scrolls into view, give it genuine movement" — not just a
 * fade). Each section rises 32px and fades in as it crosses the viewport,
 * once, so scrolling back up doesn't re-trigger it. Falls back to the
 * resolved state instantly under prefers-reduced-motion.
 */
export function Reveal({ children, delay = 0, className, style }: RevealProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) return (
    <div className={className} style={style}>
      {children}
    </div>
  );

  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      variants={riseVariants}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

/** Wraps a group of items (feature grids) so they reveal one after another
 * rather than all at once — a "staggered reveal" per the same brief. */
export function RevealStagger({ children, className, style }: RevealProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) return (
    <div className={className} style={style}>
      {children}
    </div>
  );

  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  );
}

export function RevealStaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={riseVariants}>
      {children}
    </motion.div>
  );
}
