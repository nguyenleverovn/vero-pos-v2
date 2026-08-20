import {
  openVeroPosDatabase,
  requestToPromise,
  STORES,
  transactionToPromise
} from "@/lib/storage/indexedDb";

const BACKUP_FORMAT = "vero-pos-backup";
const BACKUP_VERSION = 1;
const STORE_NAMES = [
  STORES.categories,
  STORES.products,
  STORES.settings,
  STORES.orders
] as const;
const RESET_STORE_NAMES = Object.values(STORES);

type BackupData = Record<(typeof STORE_NAMES)[number], unknown[]>;

export type VeroPosBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  app: "VERO POS";
  exportedAt: string;
  data: BackupData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateStoreRecords(storeName: string, records: unknown[]) {
  const key = storeName === STORES.settings ? "key" : "id";
  return records.every((record) => isRecord(record) && typeof record[key] === "string");
}

export function parseBackup(raw: string): VeroPosBackup {
  const backup = JSON.parse(raw) as unknown;
  if (!isRecord(backup) || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !isRecord(backup.data)) {
    throw new Error("File không đúng định dạng backup VERO POS.");
  }

  for (const storeName of STORE_NAMES) {
    const records = backup.data[storeName];
    if (!Array.isArray(records) || !validateStoreRecords(storeName, records)) {
      throw new Error(`Dữ liệu ${storeName} trong file backup không hợp lệ.`);
    }
  }

  return backup as VeroPosBackup;
}

export async function createBackup(): Promise<VeroPosBackup> {
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORE_NAMES, "readonly");
  const entries = await Promise.all(STORE_NAMES.map(async (storeName) => [
    storeName,
    await requestToPromise(transaction.objectStore(storeName).getAll())
  ] as const));
  await transactionToPromise(transaction);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: "VERO POS",
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(entries) as BackupData
  };
}

export async function restoreBackup(backup: VeroPosBackup): Promise<void> {
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(STORE_NAMES, "readwrite");

  for (const storeName of STORE_NAMES) {
    const store = transaction.objectStore(storeName);
    store.clear();
    backup.data[storeName].forEach((record) => store.put(record));
  }

  await transactionToPromise(transaction);
}

export async function resetVeroPosData(): Promise<void> {
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(RESET_STORE_NAMES, "readwrite");

  await Promise.all(RESET_STORE_NAMES.map((storeName) =>
    requestToPromise(transaction.objectStore(storeName).clear())
  ));
  await transactionToPromise(transaction);

  if (typeof window !== "undefined") {
    window.localStorage.removeItem("vero-pos-product-setup-v1");
    window.localStorage.removeItem("vero-pos-anonymous-installation-id");
  }
}
