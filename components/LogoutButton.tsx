"use client";

import { useState } from "react";

export function LogoutButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Chưa thể đăng xuất.");
      window.location.assign("/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chưa thể đăng xuất.");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button className="vp-logout-button" type="button" onClick={logout} disabled={busy}>
        {busy ? "ĐANG ĐĂNG XUẤT..." : "ĐĂNG XUẤT"}
      </button>
      {error && <span className="vp-logout-error" role="alert">{error}</span>}
    </div>
  );
}
