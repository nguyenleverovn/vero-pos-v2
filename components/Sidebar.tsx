"use client";

import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { isOnboardingPath, NAV_ITEMS } from "@/lib/navigation";
import { LogoutButton } from "@/components/LogoutButton";

export function Sidebar() {
  const pathname = usePathname();
  if (isOnboardingPath(pathname)) return null;

  return (
    <aside className="vp-sidebar">
      <div className="vp-sidebar-brand">
        <Image src="/icons/vero-pos-icon.png" alt="VERO POS" width={58} height={58} unoptimized />
        <div className="vp-sidebar-brand-copy">
          <strong>VERO POS</strong>
          <span>CHẠM LÀ CHẠY</span>
        </div>
      </div>
      <nav className="vp-sidebar-nav" aria-label="Điều hướng desktop">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (pathname === "/checkout" && item.key === "pos") || (pathname === "/setup" && item.key === "menu");
          return (
            <Fragment key={item.key}>
              <Link href={item.href} className={`vp-side-link ${active ? "is-active" : ""}`}><Image src={item.icon} alt="" width={20} height={20} unoptimized /><span>{item.label}</span></Link>
              {item.key === "store" ? <Link href="/tables" className={`vp-side-link vp-side-link--sub ${pathname === "/tables" ? "is-active" : ""}`}>Cài đặt bàn</Link> : null}
            </Fragment>
          );
        })}
      </nav>
      <LogoutButton className="vp-sidebar-logout" />
    </aside>
  );
}
