"use client";

import { useEffect, useMemo, useState } from "react";
import { V1DataTools } from "@/components/V1DataTools";
import { loadOrders, PosOrder } from "@/lib/repositories/orderRepository";
import { closeCurrentShift, loadShiftSummaries, ShiftSummary } from "@/lib/repositories/shiftSummaryRepository";
import { summarizeOrders, summarizeOrdersInRange, SummaryPeriod } from "@/lib/reports/orderSummary";
import { WorkspaceMeta } from "@/components/WorkspaceMeta";

const PERIODS: Array<{ id: SummaryPeriod; label: string }> = [
  { id: "day", label: "Ngày" },
  { id: "month", label: "Tháng" },
  { id: "year", label: "Năm" }
];

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function ReportsPage() {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [period, setPeriod] = useState<SummaryPeriod>("day");
  const [loaded, setLoaded] = useState(false);
  const [shiftSummaries, setShiftSummaries] = useState<ShiftSummary[]>([]);
  const [closingShift, setClosingShift] = useState(false);
  const [shiftMessage, setShiftMessage] = useState("");
  const [operator, setOperator] = useState<{ userId: string; displayName: string; role: "owner" | "manager" | "cashier" } | undefined>();
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const summary = useMemo(() => customRange
    ? summarizeOrdersInRange(orders, localDate(customRange.start), localDate(customRange.end))
    : summarizeOrders(orders, period), [customRange, orders, period]);
  const rangeValid = Boolean(rangeStart && rangeEnd && rangeStart <= rangeEnd);
  const summariesByDay = useMemo(() => {
    const groups = new Map<string, { label: string; summaries: ShiftSummary[] }>();
    shiftSummaries.forEach((item) => {
      const closedAt = new Date(item.closedAt);
      const key = dateInputValue(closedAt);
      const group = groups.get(key) ?? {
        label: closedAt.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }),
        summaries: []
      };
      group.summaries.push(item);
      groups.set(key, group);
    });
    return Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
  }, [shiftSummaries]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadOrders(),
      loadShiftSummaries(),
      fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
    ]).then(([savedOrders, savedSummaries, account]) => {
      if (!cancelled) {
        setOrders(savedOrders);
        setShiftSummaries(savedSummaries);
        if (account?.user && account?.stores?.[0]) setOperator({ userId: account.user.id, displayName: account.user.displayName, role: account.stores[0].role });
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  function toggleRangePicker() {
    if (!rangeStart || !rangeEnd) {
      const today = new Date();
      setRangeStart(dateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)));
      setRangeEnd(dateInputValue(today));
    }
    setRangeOpen((current) => !current);
  }

  function applyRange() {
    if (!rangeValid) return;
    setCustomRange({ start: rangeStart, end: rangeEnd });
    setRangeOpen(false);
  }

  function selectPeriod(nextPeriod: SummaryPeriod) {
    setPeriod(nextPeriod);
    setCustomRange(null);
    setRangeOpen(false);
  }

  async function handleCloseShift() {
    setClosingShift(true);
    setShiftMessage("");
    try {
      const closedShift = await closeCurrentShift(orders, operator);
      if (!closedShift) {
        setShiftMessage("Chưa có đơn mới kể từ lần tổng kết gần nhất.");
        return;
      }
      setShiftSummaries((current) => [closedShift, ...current]);
      setShiftMessage(`Đã tổng kết ${closedShift.orderCount} đơn, doanh thu ${closedShift.revenueVnd.toLocaleString("vi-VN")}đ.`);
    } finally {
      setClosingShift(false);
    }
  }

  return (
    <main className="vp-screen vp-screen--plain">
      <header className="vp-screen-heading"><h1>Báo cáo Doanh thu</h1><WorkspaceMeta /></header>
      <div className="vp-period-tabs" role="tablist" aria-label="Kỳ tổng kết">
        {PERIODS.map((item) => <button key={item.id} role="tab" aria-selected={!customRange && period === item.id} className={!customRange && period === item.id ? "is-active" : ""} onClick={() => selectPeriod(item.id)}>{item.label}</button>)}
      </div>
      <div className="vp-report-date-control">
        <button className="vp-report-date-trigger" type="button" onClick={toggleRangePicker} aria-expanded={rangeOpen}>
          <span>Khoảng thời gian</span><strong>{summary.label}</strong>
        </button>
        {rangeOpen && (
          <div className="vp-report-date-panel">
            <label><span>Từ ngày</span><input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} /></label>
            <label><span>Đến ngày</span><input type="date" value={rangeEnd} min={rangeStart} onChange={(event) => setRangeEnd(event.target.value)} /></label>
            <button className="vp-report-date-apply" type="button" onClick={applyRange} disabled={!rangeValid}>Áp dụng</button>
            {customRange && <button className="vp-report-date-clear" type="button" onClick={() => { setCustomRange(null); setRangeOpen(false); }}>Về kỳ hiện tại</button>}
          </div>
        )}
      </div>
      <section className="vp-report-kpis">
        <div className="vp-hero-metric"><span>{customRange ? "Doanh thu trong khoảng đã chọn" : `Doanh thu ${period === "day" ? "hôm nay" : period === "month" ? "tháng này" : "năm nay"}`}</span><strong>{summary.revenue.toLocaleString("vi-VN")} đ</strong><small>{customRange ? summary.label : summary.growthPercent === null ? "Chưa có dữ liệu kỳ trước" : <><b>{summary.growthPercent >= 0 ? "+" : ""}{summary.growthPercent}%</b>&nbsp; so với kỳ trước</>}</small></div>
        <div className="vp-stat vp-stat--white"><span>Số đơn hàng</span><strong>{summary.orderCount} đơn</strong></div>
        <div className="vp-stat vp-stat--white"><span>Trung bình đơn</span><strong>{summary.averageOrder.toLocaleString("vi-VN")} đ</strong></div>
      </section>
      <section className="vp-shift-control">
        <div className="vp-shift-copy"><strong>Tổng kết ca</strong><span>Chốt các đơn mới từ lần tổng kết gần nhất. Dữ liệu đã chốt vẫn nằm trong Nhật ký hóa đơn.</span></div>
        <button type="button" onClick={handleCloseShift} disabled={!loaded || closingShift}>{closingShift ? "Đang tổng kết..." : "Tổng kết ca"}</button>
      </section>
      {shiftMessage && <p className="vp-shift-message" role="status">{shiftMessage}</p>}
      {!loaded ? <div className="vp-menu-empty">Đang tải dữ liệu bán hàng...</div> : (
        <div className="vp-report-grid">
          <section><h2 className="vp-section-title">Doanh thu theo {customRange ? "khoảng ngày" : period === "day" ? "giờ" : period === "month" ? "ngày" : "tháng"}</h2><div className="vp-chart-card">{summary.timeline.map((item) => <div className="vp-bar-item" key={item.label} title={`${item.revenue.toLocaleString("vi-VN")}đ`}><span className="vp-bar" style={{ height: `${item.height}%` }} /><span>{item.label}</span></div>)}</div></section>
          <section><h2 className="vp-section-title">Món bán chạy nhất</h2><div className="vp-ranking">{summary.topProducts.length > 0 ? summary.topProducts.map((item, index) => <div className="vp-rank-item" key={item.name}><span className="vp-rank-number">{index + 1}</span><span className="vp-rank-name">{item.name}</span><span className="vp-rank-qty">{item.quantity} ly</span><span className="vp-rank-revenue">{item.revenue.toLocaleString("vi-VN")}đ</span></div>) : <div className="vp-menu-empty">Chưa có đơn trong kỳ này.</div>}</div></section>
        </div>
      )}
      <section className="vp-shift-history">
        <h2 className="vp-section-title">Các ca đã tổng kết</h2>
        {summariesByDay.length > 0 ? summariesByDay.map((group) => (
          <div className="vp-shift-day" key={group.key}>
            <h3>{group.label}</h3>
            <div className="vp-shift-list">
              {group.summaries.map((item) => (
                <article key={item.id}>
                  <div><strong>{new Date(item.startedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} - {new Date(item.closedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</strong><span>{item.closedByDisplayName ? `Nhân viên kết ca: ${item.closedByDisplayName} · ` : ""}{item.orderCount} đơn · Trung bình {item.averageOrderVnd.toLocaleString("vi-VN")}đ</span></div>
                  <b>{item.revenueVnd.toLocaleString("vi-VN")}đ</b>
                </article>
              ))}
            </div>
          </div>
        )) : <div className="vp-menu-empty">Chưa có ca nào được tổng kết.</div>}
      </section>
      <V1DataTools />
    </main>
  );
}
