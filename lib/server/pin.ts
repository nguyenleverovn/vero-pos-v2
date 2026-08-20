import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPin(pin: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(pin, salt, 64) as Buffer;
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPin(pin: string, storedHash: string) {
  const [algorithm, saltValue, hashValue] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;
  try {
    const expected = Buffer.from(hashValue, "base64");
    const derived = await scrypt(pin, Buffer.from(saltValue, "base64"), expected.length) as Buffer;
    return expected.length > 0 && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
