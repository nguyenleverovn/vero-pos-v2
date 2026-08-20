"use client";

import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import styles from "./GoogleAuthForm.module.css";

type GoogleCredentialResponse = { credential: string };

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
              text: "continue_with";
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

export function GoogleAuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const storeNameRef = useRef("");
  const inviteCodeRef = useRef("");
  const [storeName, setStoreName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    storeNameRef.current = storeName;
    inviteCodeRef.current = inviteCode;
  }, [storeName, inviteCode]);

  const submitCredential = useCallback(async (credential: string) => {
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          credential,
          storeName: storeNameRef.current,
          inviteCode: inviteCodeRef.current
        })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Chưa thể đăng nhập.");
      router.push("/setup");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chưa thể đăng nhập.");
      setSubmitting(false);
    }
  }, [mode, router]);

  const renderGoogleButton = useCallback(() => {
    if (!clientId || !buttonRef.current || !window.google) return;
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
      text: "continue_with",
      shape: "rectangular",
      width,
      locale: "vi"
    });
  }, [clientId, submitCredential]);

  function preventSubmit(event: FormEvent) {
    event.preventDefault();
  }

  const isRegister = mode === "register";

  return (
    <main className="vp-auth-shell">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={renderGoogleButton} />
      <section className="vp-auth-card" aria-labelledby="auth-title">
        <div className="vp-auth-brand">
          <span>VERO</span>
          <strong>POS</strong>
        </div>
        <h1 id="auth-title">{isRegister ? "Tạo cửa hàng" : "Đăng nhập"}</h1>

        <form className="vp-auth-form" onSubmit={preventSubmit}>
          {isRegister ? (
            <>
              <label>
                Tên cửa hàng
                <input
                  autoComplete="organization"
                  maxLength={160}
                  onChange={(event) => setStoreName(event.target.value)}
                  placeholder="Ví dụ: VERO Coffee"
                  required
                  value={storeName}
                />
              </label>
              <label>
                Mã mời
                <input
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={80}
                  onChange={(event) => setInviteCode(event.target.value)}
                  placeholder="Nhập mã VERO cung cấp"
                  required
                  value={inviteCode}
                />
              </label>
            </>
          ) : null}

          <div className={styles.googleArea} aria-busy={submitting}>
            {clientId ? <div className={styles.googleButton} ref={buttonRef} /> : (
              <p className={styles.error}>Đăng nhập Google chưa được cấu hình.</p>
            )}
            {submitting ? <p className={styles.note}>Đang xác minh...</p> : null}
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </form>

        <p className="vp-auth-switch">
          {isRegister ? "Đã có cửa hàng?" : "Chưa có cửa hàng?"}{" "}
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Đăng nhập" : "Đăng ký bằng mã mời"}
          </Link>
        </p>
      </section>
    </main>
  );
}
