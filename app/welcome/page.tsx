"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { trackUsageEvent } from "@/lib/analytics/usageAnalytics";

export default function WelcomePage() {
  const router = useRouter();

  function handleStart() {
    void trackUsageEvent("welcome_started");
    router.push("/login");
  }

  return (
    <main className="vp-welcome vp-onboarding">
      <section className="vp-welcome-content">
        <Image className="vp-welcome-logo" src="/icons/vero-pos-logo-full.png" alt="VERO POS - CHẠM LÀ CHẠY" width={1238} height={500} priority unoptimized />
        <button className="vp-primary-button vp-welcome-start" type="button" onClick={handleStart}>CHẠY</button>
        <a className="vp-welcome-register" href="/register">Tạo cửa hàng mới</a>
        <p className="vp-welcome-purpose">“100 ly là mục tiêu, 1000 ly là mục đích”</p>
        <div className="vp-welcome-contact">
          <p className="vp-welcome-hotline">Hotline: 028 6290 0001</p>
          <a className="vp-welcome-email" href="mailto:pos@verocoffee.vn">Email: pos@verocoffee.vn</a>
        </div>
      </section>
      <p className="vp-welcome-powered">Powered by <strong>Vero Coffee</strong></p>
    </main>
  );
}
