'use strict';

const APP_SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = 'asv-game-shell:' + encodeURIComponent(APP_SCOPE.href) + ':';
const CACHE_NAME = CACHE_PREFIX + 'v7-detailed-pixel-items';
const SHELL_PATHS = [
  'index.html',
  'assets/extra-item-sprites.png',

  'assets/board-sprites.webp',
  'assets/brick-wall.svg',
  'assets/flower-frame.svg',
  'assets/fonts/Galmuri11.woff2',
  'assets/fonts/LICENSE.txt',
  'assets/item-sprites.webp',
  'assets/market-depth-sprites.webp',
  'assets/shop-awning.svg',
  'assets/shopping-pixel-title.webp',
  'assets/terrain-tiles.webp',

  'css/style.css',
  'js/engine.js',
  'js/app.js',
  'js/pwa.js',
  'vendor/blockly.min.js',
  'vendor/blockly_ko.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/icon.svg'
];
const SHELL_URLS = SHELL_PATHS.map(path => new URL(path, APP_SCOPE).href);
const SHELL_ALLOWLIST = new Set(SHELL_URLS);
const INDEX_URL = new URL('index.html', APP_SCOPE).href;

self.addEventListener('install', event => {
  // Let an existing app finish with its current worker. Updates activate normally
  // after the previous worker has no clients; no skipWaiting or forced reload.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    SHELL_URLS.map(url => new Request(url, { cache: 'reload', credentials: 'same-origin' }))
  )));
});

self.addEventListener('activate', event => {
  // Each mounted URL owns its cache namespace, even on a shared public origin.
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name))
  )));
});

async function cachedShell(url) {
  try {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(url);
  } catch (_) {
    return undefined;
  }
}

async function networkFirst(request, cacheUrl) {
  try {
    const response = await fetch(request);
    if (response.ok && (response.type === 'basic' || response.type === 'default') &&
        (!response.url || new URL(response.url).origin === APP_SCOPE.origin)) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(cacheUrl, response.clone());
      } catch (_) {
        // Storage limits must not prevent the online app from loading.
      }
    } else if (response.status >= 500) {
      const cached = await cachedShell(cacheUrl);
      if (cached) return cached;
    }
    return response;
  } catch (_) {
    return (await cachedShell(cacheUrl)) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== APP_SCOPE.origin || !url.pathname.startsWith(APP_SCOPE.pathname)) return;

  const relativePath = url.pathname.slice(APP_SCOPE.pathname.length);
  // Leaderboards, attempts and all future API calls always use the network.
  // Never respondWith, inspect, store or provide an offline response for them.
  if (relativePath === 'api' || relativePath.startsWith('api/')) return;

  if (request.mode === 'navigate') {
    // The app has one document. Unknown paths and server data are not app routes.
    if (relativePath === '' || relativePath === 'index.html') {
      event.respondWith(networkFirst(request, INDEX_URL));
    }
    return;
  }

  // Ignore query strings for shell storage; never cache unknown files, fonts
  // from another origin, API data, database files, or arbitrary navigations.
  const canonicalUrl = new URL(url.pathname, APP_SCOPE.origin).href;
  if (SHELL_ALLOWLIST.has(canonicalUrl)) {
    event.respondWith(networkFirst(request, canonicalUrl));
  }
});
