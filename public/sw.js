const CACHE_NAME = "vero-pos-v9";
const APP_ROUTES = [
  "/",
  "/welcome",
  "/setup",
  "/checkout",
  "/menu",
  "/receipts",
  "/receipts/offline",
  "/reports"
  ,"/tables"
];
const STATIC_ASSETS = [
  "/manifest.json",
  "/icons/cart.svg",
  "/icons/chart.svg",
  "/icons/chevron-left.svg",
  "/icons/coffee.svg",
  "/icons/receipt.svg",
  "/icons/search.svg",
  "/icons/vero-pos-brand-lockup.png",
  "/icons/vero-pos-icon.png",
  "/icons/vero-pos-logo-full.png",
  "/icons/vero-pos-app-192-v3.png",
  "/icons/vero-pos-app-512-v3.png"
];

function canCache(response) {
  return response && response.ok && (response.type === "basic" || response.type === "default");
}

async function fetchAndCache(cache, url) {
  try {
    const response = await fetch(new Request(url, { cache: "reload" }));
    if (canCache(response)) await cache.put(url, response.clone());
    return response;
  } catch {
    return null;
  }
}

function assetsFromHtml(html) {
  const assets = new Set();
  const attributePattern = /(?:src|href)=["']([^"']+)["']/g;
  let match = attributePattern.exec(html);

  while (match) {
    try {
      const url = new URL(match[1], self.location.origin);
      if (url.origin === self.location.origin && (
        url.pathname.startsWith("/_next/static/")
        || url.pathname.startsWith("/icons/")
      )) assets.add(url.href);
    } catch {
      // Ignore malformed asset URLs in generated HTML.
    }
    match = attributePattern.exec(html);
  }

  return assets;
}

async function warmAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(STATIC_ASSETS.map((asset) => fetchAndCache(cache, asset)));

  const routeResponses = await Promise.all(APP_ROUTES.map((route) => fetchAndCache(cache, route)));
  const discoveredAssets = new Set();

  for (const response of routeResponses) {
    if (!canCache(response)) continue;
    const html = await response.clone().text();
    assetsFromHtml(html).forEach((asset) => discoveredAssets.add(asset));
  }

  await Promise.all(Array.from(discoveredAssets).map((asset) => fetchAndCache(cache, asset)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(warmAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("vero-pos-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  ]));
});

async function navigationResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);

  try {
    const response = await fetch(request);
    if (canCache(response)) await cache.put(url.pathname, response.clone());
    return response;
  } catch {
    const exact = await cache.match(request, { ignoreSearch: true });
    if (exact) return exact;

    const pathname = await cache.match(url.pathname);
    if (pathname) return pathname;

    if (url.pathname.startsWith("/receipts/")) {
      const receiptShell = await cache.match("/receipts/offline");
      if (receiptShell) return receiptShell;
    }

    return (await cache.match("/welcome")) || Response.error();
  }
}

async function cachedAssetResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (canCache(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  const url = new URL(request.url);

  // Account and store APIs are private, live data. Never cache or serve an
  // earlier user's response after sign-out or an application update.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }

  event.respondWith(cachedAssetResponse(request));
});
