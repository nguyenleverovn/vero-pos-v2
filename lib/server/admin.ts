export function isPlatformAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const configured = process.env.PLATFORM_ADMIN_EMAILS || "contact@verocoffee.vn";
  const admins = configured.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}
