"use client";

import Link from "next/link";
import { useState } from "react";
import { CartItem as CartLine } from "@/components/CartItem";
import { CartItem, getCartCount, getCartTotal } from "@/lib/cart/cart";

type CartProps = {
  items: CartItem[];
  onUpdateItem: (payload: CartItem) => void;
  onRemoveItem: (productId: string) => void;
  onClearAll: () => void;
  tableName?: string;
  onSaveTable?: () => void;
  onChangeService?: () => void;
};

export function Cart({ items, onUpdateItem, onRemoveItem, onClearAll, tableName, onSaveTable, onChangeService }: CartProps) {
  const [expanded, setExpanded] = useState(true);
  const total = getCartTotal(items);
  const count = getCartCount(items);
  const label = `${total.toLocaleString("vi-VN")} đ`;
  const hasItems = items.length > 0;

  const checkoutAction = hasItems
    ? <div className={tableName ? "vp-table-cart-actions" : ""}>{tableName && <button className="vp-button vp-button--secondary" type="button" onClick={onSaveTable}>LƯU BÀN</button>}<Link className="vp-primary-button" href="/checkout">THANH TOÁN</Link></div>
    : <button className="vp-primary-button" type="button" disabled>CHỌN MÓN ĐỂ THANH TOÁN</button>;

  return (
    <>
      <section className={`vp-cart-mobile ${expanded ? "is-expanded" : ""}`} aria-label="Giỏ hàng">
        <button
          className="vp-cart-toggle"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="vp-cart-count"><span className="vp-cart-badge">{count}</span>Món đã chọn</span>
          <span className="vp-cart-toggle-summary">
            <strong className="vp-cart-total">{label}</strong>
            <span>{expanded ? "Thu gọn" : "Sửa giỏ"}</span>
          </span>
        </button>
        <div className="vp-cart-mobile-details">
          {hasItems ? (
            <ul className="vp-cart-list">
              {items.map((item) => <CartLine key={item.product.id} item={item} onChange={onUpdateItem} onRemove={onRemoveItem} />)}
            </ul>
          ) : (
            <p className="vp-cart-empty">Chạm vào món để thêm vào đơn</p>
          )}
        </div>
        {checkoutAction}
      </section>

      <aside className="vp-cart-desktop">
        <div className="vp-cart-row"><div><h2>{tableName || "Đơn tại quầy"}</h2>{onChangeService && <button className="vp-cart-change-service" type="button" onClick={onChangeService}>Đổi hình thức</button>}</div><button className="vp-button vp-button--secondary" type="button" onClick={onClearAll} disabled={!hasItems}>Làm mới</button></div>
        {hasItems ? (
          <ul className="vp-cart-list">
            {items.map((item) => <CartLine key={item.product.id} item={item} onChange={onUpdateItem} onRemove={onRemoveItem} />)}
          </ul>
        ) : (
          <p className="vp-cart-empty">Chạm vào món để bắt đầu đơn hàng</p>
        )}
        <div className="vp-cart-row"><strong>Tổng cộng</strong><strong>{label}</strong></div>
        {checkoutAction}
      </aside>
    </>
  );
}
