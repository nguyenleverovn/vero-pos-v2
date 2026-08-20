export type StoreRole = "owner" | "manager" | "cashier";

export function canManageStore(role: StoreRole | null) {
  return role === "owner" || role === "manager";
}

export function canManageMenu(role: StoreRole | null) {
  return role === "owner" || role === "manager";
}

export function canRestoreData(role: StoreRole | null) {
  return role === "owner";
}
