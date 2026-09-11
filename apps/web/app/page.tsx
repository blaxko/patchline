import { Inter, Space_Mono } from "next/font/google";
import { LandingPage } from "../components/landing/LandingPage";

// DESIGN.md's own documented substitutes for the extracted (non-real)
// Frame.io font names: Inter stands in for "FrameGothic" (body + display —
// the design system deliberately uses one geometric sans for everything),
// Space Mono stands in for "NeueMachinaInktrap" (eyebrow labels only).
const display = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Patchline — Reliability for voice agents",
  description:
    "Patchline verifies critical speech before it can trigger a business action, repairs it live when it's wrong, and turns every failure into a permanent regression test.",
};

export default function Page() {
  return (
    <div className={`${display.variable} ${mono.variable}`}>
      <LandingPage />
    </div>
  );
}
