export type NavKey = "pos" | "receipts" | "menu" | "reports";
export type NavHref = "/" | "/receipts" | "/menu" | "/reports";

export type NavItem = {
  key: NavKey;
  href: NavHref;
  label: string;
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "pos", href: "/", label: "Bán hàng", icon: "/icons/cart.svg?v=2" },
  { key: "receipts", href: "/receipts", label: "Hóa đơn", icon: "/icons/receipt.svg?v=2" },
  { key: "menu", href: "/menu", label: "Menu", icon: "/icons/coffee.svg?v=2" },
  { key: "reports", href: "/reports", label: "Tổng kết", icon: "/icons/chart.svg?v=2" }
];

const ONBOARDING_PATHS = ["/welcome", "/login", "/register"];

export function isOnboardingPath(pathname: string) {
  return ONBOARDING_PATHS.includes(pathname);
}
