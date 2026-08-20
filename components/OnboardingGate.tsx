"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowedPath, setAllowedPath] = useState<string | null>(null);
  const isPublicPath = pathname === "/login" || pathname === "/register" || pathname === "/welcome";

  useEffect(() => {
    if (isPublicPath) {
      setAllowedPath(pathname);
      return;
    }

    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => {
        if (cancelled) return;
        if (response.ok) setAllowedPath(pathname);
        else router.replace("/login");
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });

    return () => { cancelled = true; };
  }, [isPublicPath, pathname, router]);

  return allowedPath === pathname ? children : null;
}
