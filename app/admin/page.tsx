"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./Admin.module.css";

type Overview = {
  stats: { stores: number; owners: number; staff: number; registeredToday: number };
  stores: Array<{
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    status: "active" | "disabled";
    createdAt: string;
    ownerName: string;
    ownerEmail: string | null;
    staffCount: number;
    lastLoginAt: string | null;
  }>;
};

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Chưa đăng nhập";
}

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as Overview & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Chưa thể tải dữ liệu quản trị.");
        setOverview(payload);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Chưa thể tải dữ liệu quản trị."));
  }, []);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div><span>VERO CONTROL</span><h1>Quản trị VERO POS</h1><p>Danh sách cửa hàng đã đăng ký. Không hiển thị dữ liệu bán hàng của khách.</p></div>
        <Link href="/store">Về cửa hàng</Link>
      </header>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {!overview && !error && <div className={styles.loading}>Đang tải dữ liệu đăng ký...</div>}
      {overview && (
        <>
          <section className={styles.stats}>
            <article><span>Cửa hàng</span><strong>{overview.stats.stores}</strong></article>
            <article><span>Đăng ký hôm nay</span><strong>{overview.stats.registeredToday}</strong></article>
            <article><span>Chủ cửa hàng</span><strong>{overview.stats.owners}</strong></article>
            <article><span>Nhân viên</span><strong>{overview.stats.staff}</strong></article>
          </section>
          <section className={styles.directory}>
            <div className={styles.directoryHeading}><h2>Cửa hàng đã đăng ký</h2><span>{overview.stores.length} kết quả gần nhất</span></div>
            {overview.stores.length ? overview.stores.map((store) => (
              <article className={styles.store} key={store.id}>
                <div className={styles.storeMain}><strong>{store.name}</strong><span>{store.address || "Chưa có địa chỉ"}</span></div>
                <div><span>Chủ cửa hàng</span><strong>{store.ownerName}</strong><small>{store.ownerEmail || "Không có Gmail"}</small></div>
                <div><span>Liên hệ</span><strong>{store.phone || "Chưa có"}</strong><small>{store.staffCount} nhân viên</small></div>
                <div><span>Đăng ký</span><strong>{dateTime(store.createdAt)}</strong><small>Đăng nhập gần nhất: {dateTime(store.lastLoginAt)}</small></div>
                <b className={store.status === "active" ? styles.active : styles.disabled}>{store.status === "active" ? "Hoạt động" : "Đã khóa"}</b>
              </article>
            )) : <div className={styles.empty}>Chưa có cửa hàng nào đăng ký.</div>}
          </section>
        </>
      )}
    </main>
  );
}
