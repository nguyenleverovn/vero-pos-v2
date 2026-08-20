import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./responsive.css";
import "./auth.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { BottomNav } from "@/components/BottomNav";
import { Sidebar } from "@/components/Sidebar";
import { OnboardingGate } from "@/components/OnboardingGate";
import { UsageAnalytics } from "@/components/UsageAnalytics";

const cloudflareAnalyticsToken = process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;

export const metadata: Metadata = {
  applicationName: "VERO POS",
  title: "VERO POS - Chạm là chạy",
  description: "Ứng dụng bán hàng dành cho quán cà phê",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VERO POS"
  },
  icons: {
    icon: "/icons/vero-pos-app-192-v2.png",
    apple: "/icons/vero-pos-app-192-v2.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf7f2"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <OnboardingGate>
          <div className="vp-app-frame">
            <Sidebar />
            <div className="vp-content">{children}</div>
          </div>
          <BottomNav />
        </OnboardingGate>
        <ServiceWorkerRegister />
        <UsageAnalytics />
        {cloudflareAnalyticsToken ? (
          <Script
            id="cloudflare-web-analytics"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: cloudflareAnalyticsToken })}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
