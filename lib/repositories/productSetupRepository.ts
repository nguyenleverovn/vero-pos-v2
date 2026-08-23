import {
  getInitialProductSetup,
  ProductCategory,
  ProductSetupState,
  SetupProduct
} from "@/lib/onboarding/productSetup";
import { getCatalog } from "@/lib/data/catalog";
import {
  openVeroPosDatabase,
  requestToPromise,
  STORES,
  transactionToPromise
} from "@/lib/storage/indexedDb";

const LEGACY_STORAGE_KEY = "vero-pos-product-setup-v1";
const SETUP_SETTING_KEY = "product-setup";

type SetupSetting = {
  key: typeof SETUP_SETTING_KEY;
  completed: boolean;
  categoryOrder?: ProductCategory["id"][];
};

function parseLegacyState(): ProductSetupState | null {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? "null") as Partial<ProductSetupState> | null;
    if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.products)) return null;

    return {
      categories: parsed.categories,
      products: parsed.products,
      completed: parsed.completed === true
    };
  } catch {
    return null;
  }
}

async function readIndexedDbState(): Promise<{ state: ProductSetupState; persisted: boolean }> {
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(
    [STORES.categories, STORES.products, STORES.settings],
    "readonly"
  );
  const categoriesRequest = transaction.objectStore(STORES.categories).getAll();
  const productsRequest = transaction.objectStore(STORES.products).getAll();
  const settingRequest = transaction.objectStore(STORES.settings).get(SETUP_SETTING_KEY);

  const [categories, products, setting] = await Promise.all([
    requestToPromise(categoriesRequest) as Promise<ProductCategory[]>,
    requestToPromise(productsRequest) as Promise<SetupProduct[]>,
    requestToPromise(settingRequest) as Promise<SetupSetting | undefined>
  ]);
  await transactionToPromise(transaction);

  const initial = getInitialProductSetup();
  const categoryOrder = new Map(
    (setting?.categoryOrder ?? []).map((categoryId, index) => [categoryId, index])
  );
  const orderedCategories = categoryOrder.size > 0
    ? [...categories].sort((left, right) =>
      (categoryOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
      - (categoryOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER))
    : categories;

  return {
    state: {
      categories: orderedCategories.length > 0 ? orderedCategories : initial.categories,
      products,
      completed: setting?.completed === true
    },
    persisted: categories.length > 0 || products.length > 0 || Boolean(setting)
  };
}

export async function loadProductSetup(): Promise<ProductSetupState> {
  if (typeof window === "undefined") return getInitialProductSetup();

  const indexedDb = await readIndexedDbState();
  if (indexedDb.persisted) return indexedDb.state;

  const legacy = parseLegacyState();
  if (!legacy) return indexedDb.state;

  await saveProductSetup(legacy);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  return legacy;
}

export async function saveProductSetup(state: ProductSetupState): Promise<void> {
  const database = await openVeroPosDatabase();
  const transaction = database.transaction(
    [STORES.categories, STORES.products, STORES.settings],
    "readwrite"
  );
  const categoryStore = transaction.objectStore(STORES.categories);
  const productStore = transaction.objectStore(STORES.products);
  const settingStore = transaction.objectStore(STORES.settings);
  const requests: Array<Promise<unknown>> = [
    requestToPromise(categoryStore.clear()),
    requestToPromise(productStore.clear()),
    requestToPromise(settingStore.put({
      key: SETUP_SETTING_KEY,
      completed: state.completed,
      categoryOrder: state.categories.map((category) => category.id)
    } satisfies SetupSetting))
  ];

  state.categories.forEach((category) => requests.push(requestToPromise(categoryStore.put(category))));
  state.products.forEach((product) => requests.push(requestToPromise(productStore.put(product))));

  await Promise.all(requests);
  await transactionToPromise(transaction);
}

export async function completeProductSetup(
  categories: ProductCategory[],
  products: SetupProduct[]
): Promise<void> {
  await saveProductSetup({ categories, products, completed: true });
}

export async function isProductSetupComplete(): Promise<boolean> {
  return (await loadProductSetup()).completed;
}

async function loadMutableProductSetup(): Promise<ProductSetupState> {
  const state = await loadProductSetup();
  if (state.completed || state.products.length > 0) return state;

  const catalog = getCatalog();
  return {
    categories: catalog.categories.map((category) => ({ ...category })),
    products: catalog.products.map((product) => ({
      id: product.id,
      name: product.name,
      priceVnd: product.priceVnd,
      categoryId: product.category,
      note: product.note,
      active: product.active
    })),
    completed: true
  };
}

export async function updateSetupProductActive(productId: string, active: boolean): Promise<void> {
  const state = await loadMutableProductSetup();
  await saveProductSetup({
    ...state,
    products: state.products.map((product) => product.id === productId ? { ...product, active } : product)
  });
}

export async function updateSetupCategoryOrder(categories: ProductCategory[]): Promise<void> {
  const state = await loadMutableProductSetup();
  await saveProductSetup({ ...state, categories });
}

export async function deleteSetupProduct(productId: string): Promise<void> {
  const state = await loadMutableProductSetup();
  await saveProductSetup({
    ...state,
    products: state.products.filter((product) => product.id !== productId)
  });
}

export async function deleteSetupCategory(categoryId: ProductCategory["id"]): Promise<boolean> {
  const state = await loadMutableProductSetup();
  const hasProducts = state.products.some((product) => product.categoryId === categoryId);
  if (hasProducts || state.categories.length <= 1) return false;

  await saveProductSetup({
    ...state,
    categories: state.categories.filter((category) => category.id !== categoryId)
  });
  return true;
}
