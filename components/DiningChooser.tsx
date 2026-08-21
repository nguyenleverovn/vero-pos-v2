"use client";

import { useState } from "react";
import { DiningConfig, OpenTableOrder } from "@/lib/repositories/diningRepository";

type Props = {
  config: DiningConfig;
  openOrders: OpenTableOrder[];
  products: Array<{ id: string; priceVnd: number }>;
  onTakeaway: () => void;
  onTable: (tableId: string) => void;
};

export function DiningChooser({ config, openOrders, products, onTakeaway, onTable }: Props) {
  const activeTables = config.tables.filter((table) => table.active);
  const visibleAreas = config.areas.filter((area) => activeTables.some((table) => table.areaId === area.id));
  const showAreas = visibleAreas.length > 1 || visibleAreas.some((area) => area.name !== "Khu vực chung");
  const [activeAreaId, setActiveAreaId] = useState(visibleAreas[0]?.id ?? "");
  const activeArea = visibleAreas.find((area) => area.id === activeAreaId) ?? visibleAreas[0];
  const priceByProductId = new Map(products.map((product) => [product.id, product.priceVnd]));

  return (
    <main className="vp-screen vp-dining-screen">
      <header className="vp-dining-heading"><h1>Sơ đồ bàn</h1></header>
      <button className="vp-takeaway-button" type="button" onClick={onTakeaway}>BÁN MANG ĐI</button>
      <section className="vp-dining-tables" id="dining-tables">
        {showAreas && <div className="vp-area-tabs">{visibleAreas.map((area) => <button className={area.id === activeArea?.id ? "is-active" : ""} type="button" key={area.id} onClick={() => setActiveAreaId(area.id)}>{area.name}</button>)}</div>}
        <div className="vp-table-grid">
          {activeTables.filter((table) => table.areaId === activeArea?.id).map((table) => {
            const order = openOrders.find((item) => item.tableId === table.id);
            const quantity = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
            const total = order?.items.reduce((sum, item) => sum + (priceByProductId.get(item.productId) ?? 0) * item.quantity, 0) ?? 0;
            return <button className={order ? "is-busy" : ""} type="button" key={table.id} onClick={() => onTable(table.id)}><strong>{table.name}</strong>{order ? <><b>{total.toLocaleString("vi-VN")}đ</b><span>{quantity} món</span></> : <span>Bàn trống</span>}</button>;
          })}
        </div>
      </section>
    </main>
  );
}
