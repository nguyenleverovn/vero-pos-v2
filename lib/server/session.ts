import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { DatabaseClient, getPool } from "@/lib/server/db";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function cookieName() {
  return process.env.SESSION_COOKIE_NAME || "vero_pos_v2_session";
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueSession(database: DatabaseClient, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await database.query(
    "INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash(token), expiresAt]
  );
  return token;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName())?.value;
  if (token) {
    await getPool().query("UPDATE auth_sessions SET revoked_at = now() WHERE token_hash = $1", [tokenHash(token)]);
  }
  cookieStore.set(cookieName(), "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getCurrentAccount() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName())?.value;
  if (!token) return null;

  const userResult = await getPool().query<{
    id: string;
    display_name: string;
    email: string | null;
    phone: string | null;
  }>(
    `SELECT u.id, u.display_name, u.email, u.phone
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.status = 'active'
      LIMIT 1`,
    [tokenHash(token)]
  );
  const user = userResult.rows[0];
  if (!user) return null;

  const storesResult = await getPool().query<{
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    timezone: string;
    currency_code: string;
    role: "owner" | "manager" | "cashier";
  }>(
    `SELECT s.id, s.name, s.phone, s.address, s.timezone, s.currency_code, m.role
       FROM store_memberships m
       JOIN stores s ON s.id = m.store_id
      WHERE m.user_id = $1
        AND m.status = 'active'
        AND s.status = 'active'
      ORDER BY m.created_at`,
    [user.id]
  );

  return {
    user: { id: user.id, displayName: user.display_name, email: user.email, phone: user.phone },
    stores: storesResult.rows.map((store) => ({
      id: store.id,
      name: store.name,
      phone: store.phone,
      address: store.address,
      timezone: store.timezone,
      currencyCode: store.currency_code,
      role: store.role
    }))
  };
}
