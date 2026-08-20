"use client";

import { useEffect, useState } from "react";
import { StoreRole } from "@/lib/permissions";

export function useStoreRole() {
  const [role, setRole] = useState<StoreRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((account: { stores?: Array<{ role: StoreRole }> } | null) => {
        if (!cancelled) setRole(account?.stores?.[0]?.role ?? null);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return role;
}
