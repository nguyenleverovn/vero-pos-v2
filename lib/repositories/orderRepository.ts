import { CartItem, getCartTotal } from "@/lib/cart/cart";
import {
  openVeroPosDatabase,
  requestToPromise,
  STORES,
  transactionToPromise
} from "@/lib/storage/indexedDb";

export type PaymentMethod = "cash" | "transfer";

export type OrderLine = {
  productId: string;
  name: string;
  priceVnd: number;
  quantity: number;
};

export type PosOrder = {
  id: string;
  orderNumber: number;
  createdAt: string;
  paymentMethod: PaymentMethod;
  items: OrderLine[];
  totalVnd: number;
  subtotalVnd?: number;
  discountVnd?: number;
  promotionId?: string;
  promotionName?: string;
  serviceMode?: "counter" | "takeaway" | "table";
  tableName?: string;
};

type StoredPosOrder = Omit<PosOrder, "orderNumber"> & { orderNumber?: number };

export function formatOrderCode(orderNumber: number) {
  return `Đơn ${orderNumber}`;
}

function createOrderId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `order-${Date.now()}`;
}

export async function saveOrder(items: CartItem[], paymentMethod: PaymentMethod, service?: { mode: "takeaway" | "table"; tableName?: string; discountVnd?: number; promotionId?: string; promotionName?: string }): Promise<PosOrder> {
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORES.orders, "readwrite");
  const store = transaction.objectStore(STORES.orders);
  const existingOrders = await requestToPromise(store.getAll()) as StoredPosOrder[];
  const orderNumber = Math.max(
    existingOrders.length,
    ...existingOrders.map((order) => order.orderNumber ?? 0)
  ) + 1;
  const subtotalVnd = getCartTotal(items);
  const discountVnd = Math.min(subtotalVnd, Math.max(0, Math.round(service?.discountVnd ?? 0)));
  const order: PosOrder = {
    id: createOrderId(),
    orderNumber,
    createdAt: new Date().toISOString(),
    paymentMethod,
    items: items.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      priceVnd: item.product.priceVnd,
      quantity: item.quantity
    })),
    subtotalVnd,
    discountVnd,
    promotionId: service?.promotionId,
    promotionName: service?.promotionName,
    totalVnd: subtotalVnd - discountVnd,
    serviceMode: service?.mode ?? "takeaway",
    tableName: service?.tableName
  };

  await requestToPromise(store.put(order));
  await transactionToPromise(transaction);
  return order;
}

export async function loadOrders(): Promise<PosOrder[]> {
  if (typeof window === "undefined") return [];

  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORES.orders, "readonly");
  const storedOrders = await requestToPromise(transaction.objectStore(STORES.orders).getAll()) as StoredPosOrder[];
  await transactionToPromise(transaction);
  return storedOrders
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((order, index) => ({ ...order, orderNumber: order.orderNumber ?? index + 1 }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function loadOrder(orderId: string): Promise<PosOrder | undefined> {
  return (await loadOrders()).find((order) => order.id === orderId);
}
