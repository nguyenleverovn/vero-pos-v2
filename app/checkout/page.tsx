"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CartItem, clearCart, getCartTotal, loadCart } from "@/lib/cart/cart";
import { loadCatalog } from "@/lib/repositories/catalogRepository";
import { PaymentMethod, saveOrder } from "@/lib/repositories/orderRepository";
import { loadPaymentQrCode } from "@/lib/repositories/qrCodeRepository";
import { WorkspaceMeta } from "@/components/WorkspaceMeta";
import { trackUsageEvent } from "@/lib/analytics/usageAnalytics";
import { clearSaleContext, closeOpenTableOrder, DiningConfig, loadDiningConfig, loadSaleContext, saveSaleContext, SaleContext } from "@/lib/repositories/diningRepository";
import { PromotionPicker } from "@/components/PromotionPicker";
import { calculateDiscount, clearAppliedPromotion, loadAppliedPromotion, loadPromotions, Promotion, saveAppliedPromotion } from "@/lib/repositories/promotionRepository";

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [printTiming, setPrintTiming] = useState<"now" | "later">("later");
  const [isCompleting, setIsCompleting] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [saleContext, setSaleContext] = useState<SaleContext>({ mode: "takeaway" });
  const [tableName, setTableName] = useState("");
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const subtotal = getCartTotal(items);
  const discount = calculateDiscount(subtotal, selectedPromotion);
  const due = subtotal - discount;
  const canComplete = items.length > 0 && !isCompleting;
  const checkoutActionLabel = isCompleting
    ? "ĐANG LƯU ĐƠN..."
    : printTiming === "now"
      ? "HOÀN TẤT & IN HÓA ĐƠN"
      : "HOÀN TẤT ĐƠN";

  useEffect(() => {
    loadCatalog().then((catalog) => {
      const savedItems = loadCart(catalog.products);
      setItems(savedItems);
    });
  }, []);

  useEffect(() => {
    loadPaymentQrCode().then(setQrCode);
    Promise.all([loadDiningConfig(), Promise.resolve(loadSaleContext()), loadPromotions()]).then(([config, context, savedPromotions]: [DiningConfig, SaleContext | null, Promotion[]]) => {
      const current = context ?? { mode: "takeaway" };
      setSaleContext(current);
      if (current.mode === "table") setTableName(config.tables.find((table) => table.id === current.tableId)?.name ?? "Bàn");
      const activePromotions = savedPromotions.filter((promotion) => promotion.active);
      const applied = loadAppliedPromotion();
      setPromotions(activePromotions);
      setSelectedPromotion(activePromotions.find((promotion) => promotion.id === applied?.id) ?? null);
    });
  }, []);

  function selectPromotion(promotion: Promotion | null) {
    setSelectedPromotion(promotion);
    saveAppliedPromotion(promotion);
  }

  const completeCheckout = async () => {
    if (!canComplete) return;
    setIsCompleting(true);

    try {
      const order = await saveOrder(items, method, { mode: saleContext.mode, tableName: tableName || undefined, discountVnd: discount, promotionId: selectedPromotion?.id, promotionName: selectedPromotion?.name });
      if (saleContext.mode === "table") await closeOpenTableOrder(saleContext.tableId);
      void trackUsageEvent("order_completed");
      clearCart();
      clearAppliedPromotion();
      if (saleContext.mode === "table") {
        clearSaleContext();
      } else {
        saveSaleContext({ mode: "takeaway" });
      }
      if (printTiming === "now") {
        router.push(`/receipts/${encodeURIComponent(order.id)}?print=1`);
      } else {
        router.replace("/");
      }
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <main className="vp-screen vp-screen--action">
      <header className="vp-screen-heading vp-screen-heading--back">
        <Link className="vp-back" href="/"><Image src="/icons/chevron-left.svg" alt="Quay lại" width={24} height={24} unoptimized /></Link>
        <h1>{tableName ? `Thanh toán ${tableName}` : "Thanh toán hóa đơn"}</h1>
        <WorkspaceMeta />
      </header>
      <div className="vp-payment-layout">
        <section className="vp-payment-summary">
          <div className="vp-payment-due"><span>Cần thanh toán</span><strong>{due.toLocaleString("vi-VN")}đ</strong></div>
          <p className="vp-payment-item-count">{items.reduce((sum, item) => sum + item.quantity, 0)} món trong đơn</p>
          <PromotionPicker promotions={promotions} selected={selectedPromotion} onChange={selectPromotion} />
          <div className="vp-methods">
            <button className={`vp-method ${method === "cash" ? "is-active" : ""}`} onClick={() => setMethod("cash")}>Tiền mặt</button>
            <button className={`vp-method ${method === "transfer" ? "is-active" : ""}`} onClick={() => setMethod("transfer")}>Chuyển khoản (QR)</button>
          </div>
          <div className="vp-checkout-print-choice">
            <strong>In hóa đơn</strong>
            <div className="vp-methods">
              <button className={`vp-method ${printTiming === "now" ? "is-active" : ""}`} type="button" aria-pressed={printTiming === "now"} onClick={() => setPrintTiming("now")}>In ngay</button>
              <button className={`vp-method ${printTiming === "later" ? "is-active" : ""}`} type="button" aria-pressed={printTiming === "later"} onClick={() => setPrintTiming("later")}>In sau</button>
            </div>
          </div>
          {method === "transfer" && (
            <div className="vp-checkout-qr">
              {qrCode ? <Image src={qrCode} alt="QR chuyển khoản" width={240} height={240} unoptimized /> : <p>Chưa có QR chuyển khoản. Thêm QR tại trang Hóa đơn.</p>}
            </div>
          )}
          <button className="vp-primary-button vp-checkout-desktop-action" type="button" disabled={!canComplete} onClick={completeCheckout}>{checkoutActionLabel}</button>
        </section>
        <aside className="vp-checkout-order-summary">
          <h2>Tóm tắt đơn hàng</h2>
          <ul>{items.map((item) => <li key={item.product.id}><span>{item.quantity}x {item.product.name}</span><strong>{(item.product.priceVnd * item.quantity).toLocaleString("vi-VN")}đ</strong></li>)}</ul>
          <div><span>Tiền hàng</span><strong>{subtotal.toLocaleString("vi-VN")}đ</strong></div>
          {discount > 0 && <div><span>Khuyến mãi{selectedPromotion ? ` · ${selectedPromotion.name}` : ""}</span><strong>-{discount.toLocaleString("vi-VN")}đ</strong></div>}
          <div><span>Thuế VAT (0%)</span><strong>0đ</strong></div>
          <div className="vp-checkout-total"><span>Thanh toán</span><strong>{due.toLocaleString("vi-VN")}đ</strong></div>
        </aside>
      </div>
      <div className="vp-action-panel"><button className="vp-primary-button" type="button" disabled={!canComplete} onClick={completeCheckout}>{checkoutActionLabel}</button></div>
    </main>
  );
}
