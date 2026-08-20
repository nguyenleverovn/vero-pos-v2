"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { PosCatalog } from "@/lib/data/catalog";
import { loadCatalog } from "@/lib/repositories/catalogRepository";
import { WorkspaceMeta } from "@/components/WorkspaceMeta";
import {
  updateSetupCategoryOrder,
  updateSetupProductActive
} from "@/lib/repositories/productSetupRepository";
import { useStoreRole } from "@/lib/client/useStoreRole";
import { canManageMenu } from "@/lib/permissions";

export default function MenuPage() {
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const role = useStoreRole();
  const canManage = canManageMenu(role);
  const products = catalog?.products ?? [];
  const visible = products.filter((product) =>
    product.name.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))
    && (activeCategory === "all" || product.category === activeCategory));

  useEffect(() => {
    loadCatalog().then((data) => {
      setCatalog(data);
      setEnabled(Object.fromEntries(data.products.map((product) => [product.id, product.active])));
    });
  }, []);

  async function toggleProduct(productId: string) {
    if (!canManage) return;
    const active = !enabled[productId];
    setEnabled((current) => ({ ...current, [productId]: active }));
    await updateSetupProductActive(productId, active);
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    if (!catalog || !canManage) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= catalog.categories.length) return;

    const categories = [...catalog.categories];
    const [category] = categories.splice(index, 1);
    categories.splice(targetIndex, 0, category);
    setCatalog({ ...catalog, categories });
    await updateSetupCategoryOrder(categories);
  }

  return (
    <main className="vp-screen vp-screen--plain">
      <header className="vp-screen-heading"><h1>Quản lý Thực đơn</h1><WorkspaceMeta /></header>
      <section className="vp-menu-toolbar">
        <div className="vp-menu-filters" role="tablist" aria-label="Lọc danh mục">
          <button type="button" className={activeCategory === "all" ? "is-active" : ""} onClick={() => setActiveCategory("all")}>Tất cả</button>
          {catalog?.categories.map((category) => <button type="button" role="tab" aria-selected={activeCategory === category.id} className={activeCategory === category.id ? "is-active" : ""} key={category.id} onClick={() => setActiveCategory(category.id)}>{category.label}</button>)}
        </div>
        <div className="vp-menu-tools">
          <label className="vp-search"><Image src="/icons/search.svg" alt="" width={18} height={18} unoptimized /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên món..." aria-label="Tìm món" /></label>
          {canManage && <Link className="vp-menu-add" href="/setup">Thêm món mới</Link>}
        </div>
      </section>
      {catalog && (
        <section className="vp-menu-category-order" aria-label="Sắp xếp danh mục">
          <div className="vp-menu-category-heading">
            <strong>Sắp xếp danh mục</strong>
            <span>Dùng nút mũi tên để đổi vị trí trên màn hình bán hàng</span>
          </div>
          <div className="vp-menu-category-bar">
            {catalog.categories.map((category, index) => (
              <div className="vp-menu-category-item" key={category.id}>
                <span>{category.label}</span>
                {canManage && <div>
                  <button type="button" onClick={() => moveCategory(index, -1)} disabled={index === 0} aria-label={`Đưa ${category.label} sang trái`}>←</button>
                  <button type="button" onClick={() => moveCategory(index, 1)} disabled={index === catalog.categories.length - 1} aria-label={`Đưa ${category.label} sang phải`}>→</button>
                </div>}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="vp-menu-table-head" aria-hidden="true"><span>Tên món</span><span>Danh mục</span><span>Giá bán</span><span>Trạng thái phục vụ</span><span>Hành động</span></div>
      <section className="vp-menu-list">
        {visible.length > 0 ? visible.map((product) => (
          <article className={`vp-menu-item ${enabled[product.id] ? "" : "is-disabled"}`} key={product.id}>
            <strong className="vp-menu-name" data-label="Tên món">{product.name}</strong>
            <span className="vp-menu-category" data-label="Danh mục">{catalog?.categories.find((item) => item.id === product.category)?.label}</span>
            <strong className="vp-menu-price" data-label="Giá bán">{product.priceVnd.toLocaleString("vi-VN")} đ</strong>
            <div className="vp-menu-service" data-label="Trạng thái phục vụ"><button className={`vp-switch ${enabled[product.id] ? "is-on" : ""}`} type="button" onClick={() => toggleProduct(product.id)} disabled={!canManage} aria-label={`${enabled[product.id] ? "Tắt" : "Bật"} ${product.name}`} /></div>
            <div className="vp-menu-actions" data-label="Hành động">
              {canManage ? <Link className="vp-menu-edit" href={`/setup?edit=${encodeURIComponent(product.id)}`}>Sửa</Link> : <span>Chỉ xem</span>}
            </div>
          </article>
        )) : <div className="vp-menu-empty">Chưa có món phù hợp.</div>}
      </section>
      {canManage && <Link className="vp-fab" href="/setup">＋&nbsp; Thêm món mới</Link>}
    </main>
  );
}
