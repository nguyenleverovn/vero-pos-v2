"use client";

import { Promotion } from "@/lib/repositories/promotionRepository";
import styles from "./PromotionPicker.module.css";

type PromotionPickerProps = {
  promotions: Promotion[];
  selected: Promotion | null;
  onChange: (promotion: Promotion | null) => void;
};

export function PromotionPicker({ promotions, selected, onChange }: PromotionPickerProps) {
  if (promotions.length === 0) return null;
  return (
    <section className={styles.picker} aria-label="Chọn khuyến mãi">
      <div className={styles.heading}><strong>Khuyến mãi</strong>{selected && <button type="button" onClick={() => onChange(null)}>BỎ GIẢM GIÁ</button>}</div>
      <div className={styles.options}>
        {promotions.map((promotion) => (
          <button className={selected?.id === promotion.id ? styles.active : ""} type="button" key={promotion.id} onClick={() => onChange(selected?.id === promotion.id ? null : promotion)}>
            <strong>{promotion.name}</strong>
            <span>{promotion.kind === "percent" ? `-${promotion.value}%` : `-${promotion.value.toLocaleString("vi-VN")}đ`}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
