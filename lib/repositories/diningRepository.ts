import { CartItem } from "@/lib/cart/cart";
import { Product } from "@/lib/data/catalog";
import { openVeroPosDatabase, requestToPromise, STORES, transactionToPromise } from "@/lib/storage/indexedDb";

const DINING_CONFIG_KEY = "dining-config";
const OPEN_TABLES_KEY = "dining-open-tables";
const SALE_CONTEXT_KEY = "vero-pos-sale-context-v1";

export type DiningArea = { id: string; name: string; sortOrder: number };
export type DiningTable = { id: string; areaId: string; name: string; sortOrder: number; active: boolean };
export type DiningConfig = { areas: DiningArea[]; tables: DiningTable[] };
export type OpenTableOrder = {
  tableId: string;
  openedAt: string;
  openedByDisplayName?: string;
  items: Array<{ productId: string; quantity: number }>;
};
export type SaleContext = { mode: "takeaway" } | { mode: "table"; tableId: string };

type ConfigSetting = DiningConfig & { key: typeof DINING_CONFIG_KEY };
type OpenTablesSetting = { key: typeof OPEN_TABLES_KEY; orders: OpenTableOrder[] };

function id(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDiningId(prefix: "area" | "table") { return id(prefix); }

export async function loadDiningConfig(): Promise<DiningConfig> {
  if (typeof window === "undefined") return { areas: [], tables: [] };
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORES.settings, "readonly");
  const setting = await requestToPromise(transaction.objectStore(STORES.settings).get(DINING_CONFIG_KEY)) as ConfigSetting | undefined;
  await transactionToPromise(transaction);
  return {
    areas: [...(setting?.areas ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    tables: [...(setting?.tables ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

export async function saveDiningConfig(config: DiningConfig) {
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORES.settings, "readwrite");
  await requestToPromise(transaction.objectStore(STORES.settings).put({ key: DINING_CONFIG_KEY, ...config } satisfies ConfigSetting));
  await transactionToPromise(transaction);
}

export async function loadOpenTableOrders(): Promise<OpenTableOrder[]> {
  if (typeof window === "undefined") return [];
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORES.settings, "readonly");
  const setting = await requestToPromise(transaction.objectStore(STORES.settings).get(OPEN_TABLES_KEY)) as OpenTablesSetting | undefined;
  await transactionToPromise(transaction);
  return setting?.orders ?? [];
}

async function saveOpenTableOrders(orders: OpenTableOrder[]) {
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORES.settings, "readwrite");
  await requestToPromise(transaction.objectStore(STORES.settings).put({ key: OPEN_TABLES_KEY, orders } satisfies OpenTablesSetting));
  await transactionToPromise(transaction);
}

export async function saveOpenTableOrder(tableId: string, items: CartItem[], openedByDisplayName?: string) {
  const orders = await loadOpenTableOrders();
  const existing = orders.find((order) => order.tableId === tableId);
  const next: OpenTableOrder = {
    tableId,
    openedAt: existing?.openedAt ?? new Date().toISOString(),
    openedByDisplayName: existing?.openedByDisplayName ?? openedByDisplayName,
    items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity }))
  };
  await saveOpenTableOrders([next, ...orders.filter((order) => order.tableId !== tableId)]);
  return next;
}

export async function closeOpenTableOrder(tableId: string) {
  await saveOpenTableOrders((await loadOpenTableOrders()).filter((order) => order.tableId !== tableId));
}

export function hydrateTableOrder(order: OpenTableOrder | undefined, products: Product[]): CartItem[] {
  if (!order) return [];
  return order.items.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId && item.active);
    return product && line.quantity > 0 ? [{ product, quantity: line.quantity }] : [];
  });
}

export function loadSaleContext(): SaleContext | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(SALE_CONTEXT_KEY) ?? "null") as { mode?: string; tableId?: unknown } | null;
    if (value?.mode === "counter" || value?.mode === "takeaway") return { mode: "takeaway" };
    if (value?.mode === "table" && typeof value.tableId === "string") return { mode: "table", tableId: value.tableId };
    return null;
  } catch { return null; }
}

export function saveSaleContext(context: SaleContext) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(SALE_CONTEXT_KEY, JSON.stringify(context));
}

export function clearSaleContext() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(SALE_CONTEXT_KEY);
}
