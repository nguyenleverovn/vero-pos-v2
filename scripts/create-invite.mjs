import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const label = process.argv.slice(2).join(" ").trim() || "VERO POS pilot";
const code = `VERO-${randomBytes(6).toString("hex").toUpperCase()}`;
const codeHash = createHash("sha256").update(code).digest("hex");
const pool = new Pool({ connectionString });

try {
  await pool.query("INSERT INTO invite_codes (code_hash, label) VALUES ($1, $2)", [codeHash, label]);
  console.log(`Invite code: ${code}`);
  console.log("This code is shown once and can create one store.");
} finally {
  await pool.end();
}
