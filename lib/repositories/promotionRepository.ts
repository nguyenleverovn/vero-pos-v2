import {
  openVeroPosDatabase,
  requestToPromise,
  STORES,
  transactionToPromise
} from "@/lib/storage/indexedDb";

const PROMOTIONS_KEY = "promotions-v1";
const APPLIED_PROMOTION_KEY = "vero-pos-applied-promotion-v1";

export type PromotionKind = "percent" | "fixed";

export type Promotion = {
  id: string;
  name: string;
  kind: PromotionKind;
  value: number;
  active: boolean;
};

type PromotionSetting = {
  key: typeof PROMOTIONS_KEY;
  value: Promotion[];
};

function isPromotion(value: unknown): value is Promotion {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Promotion>;
  return typeof item.id === "string"
    && typeof item.name === "string"
    && (item.kind === "percent" || item.kind === "fixed")
    && typeof item.value === "number"
    && Number.isFinite(item.value)
    && typeof item.active === "boolean";
}

export function createPromotionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `promotion-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function calculateDiscount(subtotalVnd: number, promotion: Promotion | null) {
  if (!promotion || !promotion.active || subtotalVnd <= 0) return 0;
  const rawDiscount = promotion.kind === "percent"
    ? Math.round(subtotalVnd * Math.min(100, Math.max(0, promotion.value)) / 100)
    : Math.max(0, promotion.value);
  return Math.min(subtotalVnd, rawDiscount);
}

export async function loadPromotions(): Promise<Promotion[]> {
  if (typeof window === "undefined") return [];
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORES.settings, "readonly");
  const setting = await requestToPromise(transaction.objectStore(STORES.settings).get(PROMOTIONS_KEY)) as PromotionSetting | undefined;
  await transactionToPromise(transaction);
  return Array.isArray(setting?.value) ? setting.value.filter(isPromotion) : [];
}

export async function savePromotions(promotions: Promotion[]): Promise<void> {
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORES.settings, "readwrite");
  await requestToPromise(transaction.objectStore(STORES.settings).put({ key: PROMOTIONS_KEY, value: promotions } satisfies PromotionSetting));
  await transactionToPromise(transaction);
}

export function loadAppliedPromotion(): Promotion | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(APPLIED_PROMOTION_KEY) ?? "null") as unknown;
    return isPromotion(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAppliedPromotion(promotion: Promotion | null) {
  if (typeof window === "undefined") return;
  if (promotion) window.sessionStorage.setItem(APPLIED_PROMOTION_KEY, JSON.stringify(promotion));
  else window.sessionStorage.removeItem(APPLIED_PROMOTION_KEY);
}

export function clearAppliedPromotion() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(APPLIED_PROMOTION_KEY);
}
