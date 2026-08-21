import { loadProductSetup, saveProductSetup } from "@/lib/repositories/productSetupRepository";
import { loadOrders } from "@/lib/repositories/orderRepository";

const UTF8_BOM = "\uFEFF";

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("vi");
}

function spreadsheetSafe(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number) {
  const text = spreadsheetSafe(String(value));
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values: Array<string | number>) {
  return values.map(csvCell).join(",");
}

function parseCsv(raw: string) {
  const source = raw.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, "").trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell.replace(/\r$/, "").trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function importedId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function exportMenuCsv() {
  const setup = await loadProductSetup();
  const categoryLabels = new Map(setup.categories.map((category) => [category.id, category.label]));
  const lines = [csvLine(["danh_muc", "ten_mon", "gia_ban", "trang_thai"])];
  setup.products.forEach((product) => lines.push(csvLine([
    categoryLabels.get(product.categoryId) ?? "Khác",
    product.name,
    product.priceVnd,
    product.active ? "Đang bán" : "Ngừng bán"
  ])));
  return UTF8_BOM + lines.join("\r\n");
}

export async function exportOrdersCsv() {
  const orders = await loadOrders();
  const lines = [csvLine(["ma_don", "thoi_gian", "hinh_thuc", "phuong_thuc", "so_luong_mon", "tong_tien", "chi_tiet"])];
  orders.forEach((order) => lines.push(csvLine([
    order.orderNumber,
    new Date(order.createdAt).toLocaleString("vi-VN"),
    order.tableName || "Tại quầy / Mang đi",
    order.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản",
    order.items.reduce((sum, item) => sum + item.quantity, 0),
    order.totalVnd,
    order.items.map((item) => `${item.quantity}x ${item.name}`).join(" | ")
  ])));
  return UTF8_BOM + lines.join("\r\n");
}

export async function importMenuCsv(raw: string) {
  const rows = parseCsv(raw);
  if (rows.length < 2) throw new Error("File CSV chưa có món nào.");

  const headers = rows[0].map(normalized);
  const categoryColumn = headers.indexOf("danh_muc");
  const nameColumn = headers.indexOf("ten_mon");
  const priceColumn = headers.indexOf("gia_ban");
  const activeColumn = headers.indexOf("trang_thai");
  if ([categoryColumn, nameColumn, priceColumn, activeColumn].some((index) => index < 0)) {
    throw new Error("CSV cần đủ cột: danh_muc, ten_mon, gia_ban, trang_thai.");
  }

  const parsed = rows.slice(1).map((row, index) => {
    const category = row[categoryColumn]?.trim();
    const name = row[nameColumn]?.trim();
    const priceVnd = Number((row[priceColumn] ?? "").replace(/[^0-9]/g, ""));
    const activeValue = normalized(row[activeColumn] ?? "dang ban");
    if (!category || !name || !Number.isSafeInteger(priceVnd) || priceVnd <= 0) {
      throw new Error(`Dòng ${index + 2} chưa có danh mục, tên món hoặc giá bán hợp lệ.`);
    }
    const active = !["ngung ban", "false", "0", "khong"].includes(activeValue);
    return { category, name, priceVnd, active };
  });

  const setup = await loadProductSetup();
  const categories = [...setup.categories];
  const categoryByName = new Map(categories.map((category) => [normalized(category.label), category]));
  let categoriesAdded = 0;
  parsed.forEach((item) => {
    const key = normalized(item.category);
    if (!categoryByName.has(key)) {
      const category = { id: importedId("category"), label: item.category };
      categories.push(category);
      categoryByName.set(key, category);
      categoriesAdded += 1;
    }
  });

  const products = [...setup.products];
  const productIndex = new Map(products.map((product, index) => [
    `${normalized(categoryByName.get(normalized(categories.find((category) => category.id === product.categoryId)?.label ?? ""))?.label ?? "")}|${normalized(product.name)}`,
    index
  ]));
  let created = 0;
  let updated = 0;

  parsed.forEach((item) => {
    const category = categoryByName.get(normalized(item.category))!;
    const key = `${normalized(category.label)}|${normalized(item.name)}`;
    const existingIndex = productIndex.get(key);
    if (existingIndex === undefined) {
      productIndex.set(key, products.length);
      products.push({ id: importedId("product"), name: item.name, priceVnd: item.priceVnd, categoryId: category.id, active: item.active });
      created += 1;
    } else {
      products[existingIndex] = { ...products[existingIndex], name: item.name, priceVnd: item.priceVnd, categoryId: category.id, active: item.active };
      updated += 1;
    }
  });

  await saveProductSetup({ categories, products, completed: true });
  return { created, updated, categoriesAdded };
}
