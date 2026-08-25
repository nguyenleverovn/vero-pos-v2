"use client";

import { FormEvent, useEffect, useState } from "react";
import { canManageStore, StoreRole } from "@/lib/permissions";
import {
  createPromotionId,
  loadPromotions,
  Promotion,
  PromotionKind,
  savePromotions
} from "@/lib/repositories/promotionRepository";
import styles from "./PromotionSettings.module.css";

export function PromotionSettings({ role }: { role: StoreRole }) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PromotionKind>("percent");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editable = canManageStore(role);

  useEffect(() => {
    loadPromotions()
      .then(setPromotions)
      .catch(() => setError("Chưa thể tải chương trình khuyến mãi."));
  }, []);

  async function persist(next: Promotion[], successMessage: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await savePromotions(next);
      setPromotions(next);
      setMessage(successMessage);
    } catch {
      setError("Chưa thể lưu chương trình khuyến mãi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable) return;
    const numericValue = Number(value);
    if (!name.trim() || !Number.isFinite(numericValue) || numericValue <= 0 || (kind === "percent" && numericValue > 100)) {
      setError(kind === "percent" ? "Mức giảm cần từ 1% đến 100%." : "Số tiền giảm cần lớn hơn 0.");
      return;
    }
    const next = [...promotions, { id: createPromotionId(), name: name.trim(), kind, value: Math.round(numericValue), active: true }];
    await persist(next, "Đã thêm chương trình khuyến mãi.");
    setName("");
    setValue("");
  }

  return (
    <section className={styles.card}>
      <header className={styles.heading}>
        <div><h2>Khuyến mãi</h2><p>Tạo sẵn chương trình để nhân viên chạm chọn khi thanh toán.</p></div>
      </header>
      {editable && (
        <form className={styles.form} onSubmit={handleAdd}>
          <label className={styles.name}><span>Tên chương trình</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Khách thân thiết" maxLength={80} required /></label>
          <label><span>Hình thức</span><select value={kind} onChange={(event) => setKind(event.target.value as PromotionKind)}><option value="percent">Giảm theo %</option><option value="fixed">Giảm số tiền</option></select></label>
          <label><span>{kind === "percent" ? "Mức giảm (%)" : "Số tiền giảm"}</span><input value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={kind === "percent" ? "10" : "20000"} required /></label>
          <button type="submit" disabled={busy || !name.trim() || !value}>{busy ? "ĐANG LƯU..." : "THÊM KHUYẾN MÃI"}</button>
        </form>
      )}
      {message && <p className={styles.message} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.list}>
        {promotions.length === 0 && <p className={styles.empty}>Chưa có chương trình khuyến mãi.</p>}
        {promotions.map((promotion) => (
          <article className={`${styles.item} ${!promotion.active ? styles.inactive : ""}`} key={promotion.id}>
            <div><strong>{promotion.name}</strong><span>{promotion.kind === "percent" ? `Giảm ${promotion.value}%` : `Giảm ${promotion.value.toLocaleString("vi-VN")}đ`}</span></div>
            {editable && <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void persist(promotions.map((item) => item.id === promotion.id ? { ...item, active: !item.active } : item), promotion.active ? "Đã tạm dừng chương trình." : "Đã bật chương trình.")}>{promotion.active ? "TẠM DỪNG" : "BẬT LẠI"}</button><button type="button" disabled={busy} onClick={() => void persist(promotions.filter((item) => item.id !== promotion.id), "Đã xóa chương trình khuyến mãi.")}>XÓA</button></div>}
          </article>
        ))}
      </div>
    </section>
  );
}
