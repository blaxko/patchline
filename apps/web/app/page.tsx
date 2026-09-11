import { LandingPage } from "../components/landing/LandingPage";

export const metadata = {
  title: "Patchline — Reliability for voice agents",
  description:
    "Patchline verifies critical speech before it can trigger a business action, repairs it live when it's wrong, and turns every failure into a permanent regression test.",
};

export default function Page() {
  return <LandingPage />;
}
