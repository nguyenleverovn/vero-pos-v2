"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import styles from "./GoogleAuthForm.module.css";

type GoogleCredentialResponse = { credential: string };

const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type: "standard";
              theme: "outline";
              size: "large";
              text: "signin_with" | "signup_with";
              shape: "rectangular";
              width: number;
              locale: "vi";
            }
          ) => void;
        };
      };
    };
  }
}

export function GoogleAuthForm() {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const submitCredential = useCallback(async (credential: string) => {
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; isNewAccount?: boolean };
      if (!response.ok) throw new Error(payload.error || "Chưa thể đăng nhập.");
      router.push(payload.isNewAccount ? "/store?new=1" : "/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chưa thể đăng nhập.");
      setSubmitting(false);
    }
  }, [router]);

  const renderGoogleButton = useCallback(() => {
    if (!clientId || !buttonRef.current || !window.google || buttonRef.current.childElementCount > 0) return;
    buttonRef.current.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => void submitCredential(response.credential)
    });
    const width = Math.max(220, Math.min(400, Math.floor(buttonRef.current.getBoundingClientRect().width)));
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width,
      locale: "vi"
    });
  }, [clientId, submitCredential]);

  useEffect(() => {
    if (!clientId) return;

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`
    );
    const script = existingScript || document.createElement("script");
    const handleLoad = () => renderGoogleButton();
    const handleError = () => setError("Không tải được đăng nhập Google. Vui lòng thử lại.");

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    if (!existingScript) {
      script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [clientId, renderGoogleButton]);

  async function submitStaffLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStaffSubmitting(true);
    try {
      const response = await fetch("/api/auth/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Chưa thể đăng nhập nhân viên.");
      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chưa thể đăng nhập nhân viên.");
      setStaffSubmitting(false);
    }
  }

  return (
    <main className="vp-auth">
      <section className="vp-auth-card" aria-labelledby="auth-title">
        <Image
          className="vp-auth-logo"
          src="/icons/vero-pos-logo-full.png"
          alt="VERO POS - Chạm là chạy"
          width={1238}
          height={500}
          priority
          unoptimized
        />

        <div className="vp-auth-heading">
          <h1 id="auth-title">Đăng nhập</h1>
        </div>

        <div className="vp-auth-form">
          <p className={styles.sectionLabel}>CHỦ CỬA HÀNG</p>
          <div className={styles.googleArea} aria-busy={submitting}>
            {clientId ? <div className={styles.googleButton} ref={buttonRef} /> : (
              <p className={styles.error}>Đăng nhập Google chưa được cấu hình.</p>
            )}
            {submitting ? <p className={styles.note}>Đang xác minh...</p> : null}
          </div>
          <div className={styles.divider}><span>NHÂN VIÊN</span></div>
          <form className={styles.staffForm} onSubmit={submitStaffLogin}>
            <label><span>Số điện thoại</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="090 123 4567" required /></label>
            <label><span>PIN 6 số</span><input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="current-password" placeholder="••••••" pattern="[0-9]{6}" required /></label>
            <button type="submit" disabled={staffSubmitting || pin.length !== 6}>{staffSubmitting ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP NHÂN VIÊN"}</button>
          </form>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
