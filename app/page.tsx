"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PosCatalog, Product } from "@/lib/data/catalog";
import { CategoryFilter, CategoryTabs } from "@/components/CategoryTabs";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { Cart } from "@/components/Cart";
import {
  addProduct,
  CartItem,
  changeQuantity,
  loadCart,
  removeProduct,
  saveCart
} from "@/lib/cart/cart";
import { loadCatalog } from "@/lib/repositories/catalogRepository";
import { clearCart } from "@/lib/cart/cart";
import { DiningChooser } from "@/components/DiningChooser";
import { clearSaleContext, DiningConfig, hydrateTableOrder, loadDiningConfig, loadOpenTableOrders, loadSaleContext, OpenTableOrder, saveOpenTableOrder, saveSaleContext, SaleContext } from "@/lib/repositories/diningRepository";

export default function VeroPosPage() {
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [items, setItems] = useState<CartItem[]>([]);
  const [dining, setDining] = useState<DiningConfig>({ areas: [], tables: [] });
  const [openOrders, setOpenOrders] = useState<OpenTableOrder[]>([]);
  const [saleContext, setSaleContext] = useState<SaleContext | null>(null);
  const [operatorName, setOperatorName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      loadCatalog(),
      loadDiningConfig(),
      loadOpenTableOrders(),
      fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).catch(() => null)
    ]).then(([data, diningConfig, opened, account]) => {
      setCatalog(data);
      setDining(diningConfig);
      setOpenOrders(opened);
      setOperatorName(account?.user?.displayName ?? "");
      const activeTables = diningConfig.tables.filter((table) => table.active);
      const storedContext = loadSaleContext();
      const validContext = storedContext?.mode === "table" && !activeTables.some((table) => table.id === storedContext.tableId) ? null : storedContext;
      if (activeTables.length === 0) {
        const takeaway = { mode: "takeaway" } as const;
        saveSaleContext(takeaway);
        setSaleContext(takeaway);
        setItems(loadCart(data.products));
      } else if (validContext) {
        setSaleContext(validContext);
        setItems(validContext.mode === "table" ? hydrateTableOrder(opened.find((order) => order.tableId === validContext.tableId), data.products) : loadCart(data.products));
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (catalog && ready && saleContext) saveCart(items);
  }, [catalog, items, ready, saleContext]);

  if (!catalog || !ready) return <main className="vp-screen"><Header /></main>;

  const activeTables = dining.tables.filter((table) => table.active);
  if (activeTables.length > 0 && !saleContext) {
    return <DiningChooser config={dining} openOrders={openOrders} products={catalog.products} onTakeaway={() => { clearCart(); setItems([]); const context = { mode: "takeaway" } as const; saveSaleContext(context); setSaleContext(context); }} onTable={(tableId) => { const context = { mode: "table", tableId } as const; const tableOrder = openOrders.find((order) => order.tableId === tableId); const nextItems = hydrateTableOrder(tableOrder, catalog.products); saveCart(nextItems); setItems(nextItems); saveSaleContext(context); setSaleContext(context); }} />;
  }

  const visibleProducts = catalog.products.filter((product) =>
    product.active && (activeCategory === "all" || product.category === activeCategory));

  const addToCart = (product: Product) => setItems((current) => addProduct(current, product));
  const updateCartItem = (next: CartItem) => setItems((current) =>
    changeQuantity(current, next.product.id, next.quantity));
  const selectedTable = saleContext?.mode === "table" ? dining.tables.find((table) => table.id === saleContext.tableId) : undefined;

  async function saveTable() {
    if (!selectedTable || items.length === 0) return;
    await saveOpenTableOrder(selectedTable.id, items, operatorName);
    setOpenOrders(await loadOpenTableOrders());
    clearCart();
    clearSaleContext();
    setItems([]);
    setSaleContext(null);
  }

  function changeService() {
    clearCart();
    clearSaleContext();
    setItems([]);
    setSaleContext(activeTables.length ? null : { mode: "takeaway" });
  }

  return (
    <main className="vp-screen vp-screen--pos">
      <div className="vp-pos-main">
        <Header />
        <CategoryTabs activeCategory={activeCategory} items={catalog.categories} onChange={setActiveCategory} />
        <section className="vp-product-grid" aria-label="Sản phẩm">
          {visibleProducts.length > 0 ? visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={items.find((item) => item.product.id === product.id)?.quantity ?? 0}
              onAdd={addToCart}
            />
          )) : (
            <div className="vp-pos-empty">
              <strong>Danh mục này chưa có món</strong>
              <span>Thêm món đầu tiên để bắt đầu bán hàng.</span>
              <Link href="/setup">Thêm món mới</Link>
            </div>
          )}
        </section>
      </div>
      <Cart
        items={items}
        onUpdateItem={updateCartItem}
        onRemoveItem={(id) => setItems((current) => removeProduct(current, id))}
        onClearAll={() => setItems([])}
        tableName={selectedTable?.name}
        onSaveTable={saveTable}
        onChangeService={activeTables.length ? changeService : undefined}
      />
    </main>
  );
}
