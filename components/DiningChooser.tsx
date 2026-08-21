"use client";

import { useState } from "react";
import { DiningConfig, OpenTableOrder } from "@/lib/repositories/diningRepository";

type Props = {
  config: DiningConfig;
  openOrders: OpenTableOrder[];
  onTakeaway: () => void;
  onTable: (tableId: string) => void;
};

export function DiningChooser({ config, openOrders, onTakeaway, onTable }: Props) {
  const [showTables, setShowTables] = useState(false);
  const activeTables = config.tables.filter((table) => table.active);
  const visibleAreas = config.areas.filter((area) => activeTables.some((table) => table.areaId === area.id));
  const showAreas = visibleAreas.length > 1 || visibleAreas.some((area) => area.name !== "Khu vực chung");

  function revealTables() {
    setShowTables(true);
    window.setTimeout(() => document.getElementById("dining-tables")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  return (
    <main className="vp-screen vp-dining-screen">
      <header className="vp-dining-heading"><div><span>VERO POS</span><h1>Chọn hình thức phục vụ</h1><p>Chạm một lần để bắt đầu đơn.</p></div></header>
      <section className="vp-service-choice">
        <button className="is-takeaway" type="button" onClick={onTakeaway}><strong>Mang đi</strong></button>
        <button className="is-dine-in" type="button" onClick={revealTables}><strong>Ngồi lại</strong></button>
      </section>
      {showTables && <section className="vp-dining-tables" id="dining-tables">
        <div className="vp-dining-section-title"><h2>Chọn bàn</h2>{showAreas && <span>{visibleAreas.length} khu vực</span>}</div>
        {visibleAreas.map((area) => (
          <div className="vp-dining-area" key={area.id}>
            {showAreas && <h3>{area.name}</h3>}
            <div className="vp-table-grid">
              {activeTables.filter((table) => table.areaId === area.id).map((table) => {
                const order = openOrders.find((item) => item.tableId === table.id);
                return <button className={order ? "is-busy" : ""} type="button" key={table.id} onClick={() => onTable(table.id)}><strong>{table.name}</strong><span>{order ? `${order.items.reduce((sum, item) => sum + item.quantity, 0)} món · ${new Date(order.openedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Bàn trống"}</span></button>;
              })}
            </div>
          </div>
        ))}
      </section>}
    </main>
  );
}
