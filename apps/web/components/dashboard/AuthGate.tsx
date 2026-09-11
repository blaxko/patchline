"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, UnauthorizedError } from "../../lib/api";

/** Redirects to /login if the operator token is missing/invalid — SECURITY.md:
 * the dashboard must be unreachable without login. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    apiGet("/api/configs")
      .then(() => setChecked(true))
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          // apiGet already cleared the stale token before throwing this.
          router.replace("/login");
        } else {
          // Backend unreachable for some other reason — still show the
          // dashboard shell rather than trapping the operator on a blank page.
          setChecked(true);
        }
      });
  }, [router]);

  if (!checked) return null;
  return <>{children}</>;
}
