"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import styles from "./Landing.module.css";
import { usePrefersReducedMotion } from "../../lib/usePrefersReducedMotion";

/**
 * Subtle parallax on the cosmic gradient (Section 4: "subtle parallax on
 * the background gradient"). A fixed full-viewport layer behind all
 * content, drifting a small, restrained distance as the page scrolls —
 * `.page` itself no longer paints the gradient, this layer does, so the
 * two can move at different rates. Static (no transform) under
 * prefers-reduced-motion.
 */
export function ParallaxBackground() {
  const { scrollYProgress } = useScroll();
  const reducedMotion = usePrefersReducedMotion();
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);

  return <motion.div className={styles.parallaxBg} style={reducedMotion ? undefined : { y }} />;
}
