"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const registering = mode === "register";
  const [displayName, setDisplayName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const contact = identifier.trim();
    const body = registering
      ? {
          displayName,
          storeName,
          password,
          ...(contact.includes("@") ? { email: contact } : { phone: contact })
        }
      : { identifier: contact, password };

    try {
      const response = await fetch(registering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Không thể tiếp tục. Anh/chị vui lòng thử lại.");
        return;
      }

      window.sessionStorage.setItem("vero-pos:entered", "1");
      window.dispatchEvent(new Event("vero-pos:enter"));
      router.push("/setup");
    } catch {
      setError("Không kết nối được máy chủ. Dữ liệu chưa được gửi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="vp-auth vp-onboarding">
      <section className="vp-auth-card">
        <Image className="vp-auth-logo" src="/icons/vero-pos-logo-full.png" alt="VERO POS" width={1238} height={500} priority unoptimized />
        <div className="vp-auth-heading">
          <h1>{registering ? "Tạo cửa hàng" : "Đăng nhập"}</h1>
          <p>{registering ? "Tạo tài khoản chủ quán và cửa hàng đầu tiên." : "Trở lại cửa hàng của anh/chị."}</p>
        </div>

        <form className="vp-auth-form" onSubmit={handleSubmit}>
          {registering ? (
            <>
              <label className="vp-auth-field">
                <span>Tên chủ quán</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required maxLength={120} />
              </label>
              <label className="vp-auth-field">
                <span>Tên cửa hàng</span>
                <input value={storeName} onChange={(event) => setStoreName(event.target.value)} autoComplete="organization" required maxLength={160} />
              </label>
            </>
          ) : null}

          <label className="vp-auth-field">
            <span>Email hoặc số điện thoại</span>
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required maxLength={254} inputMode="email" />
          </label>
          <label className="vp-auth-field">
            <span>Mật khẩu</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={registering ? "new-password" : "current-password"} required minLength={8} maxLength={128} />
          </label>

          {error ? <p className="vp-auth-message" role="alert">{error}</p> : null}
          <button className="vp-primary-button vp-auth-submit" type="submit" disabled={submitting}>
            {submitting ? "ĐANG XỬ LÝ..." : registering ? "TẠO CỬA HÀNG" : "ĐĂNG NHẬP"}
          </button>
        </form>

        <p className="vp-auth-switch">
          {registering ? "Đã có tài khoản? " : "Chưa có cửa hàng? "}
          <Link href={registering ? "/login" : "/register"}>{registering ? "Đăng nhập" : "Tạo cửa hàng"}</Link>
        </p>
        <Link className="vp-auth-back" href="/welcome">Quay lại trang chào</Link>
      </section>
    </main>
  );
}
