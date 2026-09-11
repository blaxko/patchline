import { Fraunces, Inter } from "next/font/google";
import { LandingPage } from "../components/landing/LandingPage";

// Section 4: a high-contrast display serif for headlines (Fraunces is the
// same "Fraunces"-class font the brief names directly) + a clean grotesk
// for everything else. next/font self-hosts these at build time — no
// external request at runtime, which matters for a laptop demo on
// possibly-unreliable venue wifi.
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "Patchline — Every word is evidence.",
  description: "Patchline makes sure your voice agent hears it right before it acts on it.",
};

export default function Page() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <LandingPage />
    </div>
  );
}
