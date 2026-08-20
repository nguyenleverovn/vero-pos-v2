"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isProductSetupComplete } from "@/lib/repositories/productSetupRepository";

const ENTRY_SESSION_KEY = "vero-pos:entered";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [entered, setEntered] = useState(() =>
    typeof window !== "undefined" && window.sessionStorage.getItem(ENTRY_SESSION_KEY) === "1"
  );
  const [allowedPath, setAllowedPath] = useState<string | null>(null);
  const isSetupPath = pathname === "/setup";
  const isWelcomePath = pathname === "/welcome";
  const isAuthPath = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    const handleEnter = () => {
      window.sessionStorage.setItem(ENTRY_SESSION_KEY, "1");
      setEntered(true);
    };
    window.addEventListener("vero-pos:enter", handleEnter);
    return () => window.removeEventListener("vero-pos:enter", handleEnter);
  }, []);

  useEffect(() => {
    if (isWelcomePath || isAuthPath) return;

    let cancelled = false;

    isProductSetupComplete().then((setupCompleted) => {
      if (cancelled) return;

      if (!entered) {
        router.replace("/welcome");
      } else if (!setupCompleted && !isSetupPath) {
        router.replace("/welcome");
      } else {
        setAllowedPath(pathname);
      }
    });

    return () => { cancelled = true; };
  }, [entered, isAuthPath, isSetupPath, isWelcomePath, pathname, router]);

  return isWelcomePath || isAuthPath || allowedPath === pathname ? children : null;
}
