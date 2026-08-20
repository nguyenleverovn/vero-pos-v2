"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { canManageStore, StoreRole } from "@/lib/permissions";
import styles from "./StoreProfile.module.css";

type StoreProfile = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  role: StoreRole;
};

const ROLE_LABELS: Record<StoreRole, string> = {
  owner: "Chủ cửa hàng",
  manager: "Quản lý",
  cashier: "Thu ngân"
};

export default function StoreProfilePage() {
  const router = useRouter();
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setIsNew(new URLSearchParams(window.location.search).get("new") === "1");
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((account: { stores?: StoreProfile[]; error?: string }) => {
        const current = account.stores?.[0];
        if (!current) throw new Error(account.error || "Không tìm thấy cửa hàng.");
        setStore(current);
        setName(current.name);
        setPhone(current.phone ?? "");
        setAddress(current.address ?? "");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Chưa thể tải cửa hàng."));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!store || !canManageStore(store.role)) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: store.id, name, phone, address })
      });
      const payload = await response.json().catch(() => ({})) as StoreProfile & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Chưa thể lưu thông tin cửa hàng.");
      setStore({ ...store, ...payload });
      if (isNew) {
        router.push("/setup");
        router.refresh();
      } else {
        setMessage("Đã lưu thông tin dùng để in hóa đơn.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chưa thể lưu thông tin cửa hàng.");
    } finally {
      setBusy(false);
    }
  }

  const editable = canManageStore(store?.role ?? null);

  return (
    <main className={styles.screen}>
      <section className={styles.card}>
        <header className={styles.heading}>
          <div><h1>Thông tin cửa hàng</h1><p>Thông tin này sẽ xuất hiện trên hóa đơn in cho khách.</p></div>
          {!isNew && <Link className={styles.back} href="/">Về bán hàng</Link>}
        </header>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}><span>Tên cửa hàng</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required disabled={!editable} /></label>
          <label className={styles.field}><span>Số điện thoại</span><input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={32} inputMode="tel" required disabled={!editable} /></label>
          <label className={`${styles.field} ${styles.fieldAddress}`}><span>Địa chỉ</span><textarea value={address} onChange={(event) => setAddress(event.target.value)} maxLength={240} required disabled={!editable} /></label>
          {store && <p className={styles.role}>Quyền hiện tại: <strong>{ROLE_LABELS[store.role]}</strong>{!editable ? " · Chỉ được xem thông tin." : ""}</p>}
          {message && <p className={styles.message} role="status">{message}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {editable && <button className={styles.submit} type="submit" disabled={busy || !name.trim() || !phone.trim() || !address.trim()}>{busy ? "ĐANG LƯU..." : isNew ? "LƯU VÀ THÊM MÓN" : "LƯU THÔNG TIN"}</button>}
        </form>
      </section>
    </main>
  );
}
