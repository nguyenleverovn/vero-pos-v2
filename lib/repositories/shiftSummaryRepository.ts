import { PosOrder } from "@/lib/repositories/orderRepository";
import {
  openVeroPosDatabase,
  requestToPromise,
  STORES,
  transactionToPromise
} from "@/lib/storage/indexedDb";

const SHIFT_SUMMARIES_KEY = "shift-summaries";

export type ShiftSummary = {
  id: string;
  startedAt: string;
  closedAt: string;
  orderCount: number;
  revenueVnd: number;
  averageOrderVnd: number;
  closedByUserId?: string;
  closedByDisplayName?: string;
  closedByRole?: "owner" | "manager" | "cashier";
};

type ShiftSummarySetting = {
  key: typeof SHIFT_SUMMARIES_KEY;
  summaries: ShiftSummary[];
};

export async function loadShiftSummaries(): Promise<ShiftSummary[]> {
  if (typeof window === "undefined") return [];

  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORES.settings, "readonly");
  const setting = await requestToPromise(
    transaction.objectStore(STORES.settings).get(SHIFT_SUMMARIES_KEY)
  ) as ShiftSummarySetting | undefined;
  await transactionToPromise(transaction);
  return [...(setting?.summaries ?? [])].sort((left, right) => right.closedAt.localeCompare(left.closedAt));
}

export async function closeCurrentShift(
  orders: PosOrder[],
  operator?: { userId: string; displayName: string; role: "owner" | "manager" | "cashier" },
  now = new Date()
): Promise<ShiftSummary | null> {
  const summaries = await loadShiftSummaries();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const latestClosedAt = summaries[0] ? new Date(summaries[0].closedAt) : dayStart;
  const startedAt = latestClosedAt > dayStart ? latestClosedAt : dayStart;
  const shiftOrders = orders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    return createdAt >= startedAt && createdAt <= now;
  });

  if (shiftOrders.length === 0) return null;

  const revenueVnd = shiftOrders.reduce((sum, order) => sum + order.totalVnd, 0);
  const summary: ShiftSummary = {
    id: `shift-${now.getTime()}`,
    startedAt: startedAt.toISOString(),
    closedAt: now.toISOString(),
    orderCount: shiftOrders.length,
    revenueVnd,
    averageOrderVnd: Math.round(revenueVnd / shiftOrders.length),
    closedByUserId: operator?.userId,
    closedByDisplayName: operator?.displayName,
    closedByRole: operator?.role
  };
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORES.settings, "readwrite");
  await requestToPromise(
    transaction.objectStore(STORES.settings).put({
      key: SHIFT_SUMMARIES_KEY,
      summaries: [summary, ...summaries]
    } satisfies ShiftSummarySetting)
  );
  await transactionToPromise(transaction);
  return summary;
}
