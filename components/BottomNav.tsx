"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { isOnboardingPath, NAV_ITEMS } from "@/lib/navigation";

export function BottomNav() {
  const pathname = usePathname();
  if (isOnboardingPath(pathname)) return null;

  return (
    <nav className="vp-bottom-nav" aria-label="Điều hướng chính">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (pathname === "/checkout" && item.key === "pos") || (pathname === "/setup" && item.key === "menu") || (pathname === "/tables" && item.key === "store");
        return (
          <Link key={item.key} href={item.href} className={`vp-bottom-item ${active ? "is-active" : ""}`}>
            <span className="vp-bottom-icon"><Image src={item.icon} alt="" width={20} height={20} unoptimized /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
