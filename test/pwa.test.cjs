'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const workerSource = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
const installSource = fs.readFileSync(path.join(__dirname, '../js/pwa.js'), 'utf8');

function workerHarness(scope, stores = new Map()) {
  const handlers = new Map(), requests = [], storageOperations = [];
  let networkMode = 'online', skipWaitingCalls = 0, claimCalls = 0;
  async function network(request) {
    const url = typeof request === 'string' ? request : request.url;
    requests.push(url);
    if (networkMode === 'offline') throw new Error('network unavailable');
    if (networkMode === 'unavailable') return new Response('unavailable', { status: 503 });
    if (networkMode === 'missing') return new Response('missing', { status: 404 });
    return new Response('network:' + url, { status: 200 });
  }
  const cacheStorage = {
    async open(name) {
      storageOperations.push(['open', name]);
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(items) {
          const responses = await Promise.all(items.map(network));
          items.forEach((request, index) => entries.set(request.url, responses[index]));
        },
        async put(url, response) {
          storageOperations.push(['put', String(url)]);
          entries.set(String(url), response);
        },
        async match(url) {
          storageOperations.push(['match', String(url)]);
          return entries.get(String(url))?.clone();
        }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { storageOperations.push(['delete', name]); return stores.delete(name); }
  };
  vm.runInNewContext(workerSource, {
    URL, Request, Response, Set, Promise, caches: cacheStorage, fetch: network,
    self: {
      registration: { scope },
      addEventListener(type, handler) { handlers.set(type, handler); },
      skipWaiting() { skipWaitingCalls++; },
      clients: { claim() { claimCalls++; } }
    }
  }, { filename: 'sw.js' });
  return {
    stores, requests, storageOperations,
    setNetwork(mode) { networkMode = mode; },
    async lifecycle(type) {
      let pending;
      handlers.get(type)({ waitUntil(value) { pending = value; } });
      await pending;
    },
    async dispatch(relative, { method = 'GET', mode = 'cors' } = {}) {
      const request = { url: new URL(relative, scope).href, method, mode };
      let intercepted = false, result;
      handlers.get('fetch')({ request, respondWith(value) { intercepted = true; result = value; } });
      return { intercepted, response: intercepted ? await result : undefined };
    },
    updateCalls() { return { skipWaitingCalls, claimCalls }; }
  };
}

test('service worker precaches a complete shell relative to its public mount', async () => {
  const scope = 'https://temp.sdy.world/mount-a/';
  const worker = workerHarness(scope);
  await worker.lifecycle('install');
  assert(worker.requests.length > 0);
  assert(worker.requests.every(url => url.startsWith(scope)));
  const cachedPaths = new Set(worker.requests.map(url => new URL(url).pathname.slice('/mount-a/'.length)));
  for (const required of ['index.html', 'css/style.css', 'js/engine.js', 'js/app.js', 'js/pwa.js',
    'vendor/blockly.min.js', 'vendor/blockly_ko.js', 'manifest.webmanifest',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']) {
    assert(cachedPaths.has(required), 'offline shell is missing ' + required);
  }
  for (const relative of cachedPaths) {
    assert(fs.existsSync(path.join(__dirname, '..', relative)), 'precache file must exist: ' + relative);
    assert(!relative.startsWith('api/'));
  }
  await worker.lifecycle('activate');
  assert.deepEqual(worker.updateCalls(), { skipWaitingCalls: 0, claimCalls: 0 });
});

test('service worker cache cleanup preserves other mounts and unrelated caches', async () => {
  const stores = new Map([['unrelated-cache', new Map()]]);
  const first = workerHarness('https://temp.sdy.world/mount-a/', stores);
  const second = workerHarness('https://temp.sdy.world/mount-a/nested/', stores);
  await first.lifecycle('install');
  const firstName = [...stores.keys()].find(name => name !== 'unrelated-cache');
  await second.lifecycle('install');
  const secondName = [...stores.keys()].find(name => name !== 'unrelated-cache' && name !== firstName);
  assert(secondName && secondName !== firstName, 'public mounts need separate cache namespaces');
  const oldFirst = firstName.slice(0, firstName.lastIndexOf(':') + 1) + 'previous-version';
  assert.notEqual(oldFirst, firstName);
  stores.set(oldFirst, new Map());
  await first.lifecycle('activate');
  assert(!stores.has(oldFirst));
  assert(stores.has(firstName));
  assert(stores.has(secondName));
  assert(stores.has('unrelated-cache'));
  assert.deepEqual(first.updateCalls(), { skipWaitingCalls: 0, claimCalls: 0 });
});

test('API requests, unknown data, other mounts and external resources bypass the worker', async () => {
  const worker = workerHarness('https://temp.sdy.world/mount-a/');
  await worker.lifecycle('install');
  const requestCount = worker.requests.length, operationCount = worker.storageOperations.length;
  for (const relative of ['api', 'api/health', 'api/leaderboard?limit=10', 'api/attempts',
    'api/attempts/id/finish', 'api/attempts/id/entry', '/api/health',
    'data/leaderboard.sqlite', 'server.cjs', 'js/unknown.js', '../mount-b/js/app.js',
    'https://fonts.googleapis.com/css2?family=Jua']) {
    for (const method of ['GET', 'POST']) {
      assert.equal((await worker.dispatch(relative, { method })).intercepted, false, method + ' ' + relative);
    }
    assert.equal((await worker.dispatch(relative, { mode: 'navigate' })).intercepted, false,
      'unknown navigation must bypass the shell: ' + relative);
  }
  assert.equal((await worker.dispatch('js/app.js', { method: 'POST' })).intercepted, false);
  worker.setNetwork('offline');
  assert.equal((await worker.dispatch('api/leaderboard')).intercepted, false, 'offline APIs must still bypass');
  assert.equal(worker.requests.length, requestCount, 'bypassed requests must not enter SW fetch handling');
  assert.equal(worker.storageOperations.length, operationCount, 'bypassed requests must never touch caches');
});

test('navigation and static resources prefer fresh responses and recover the cached shell offline', async () => {
  const scope = 'https://temp.sdy.world/mount-a/';
  const worker = workerHarness(scope);
  await worker.lifecycle('install');
  const root = await worker.dispatch('./?level=2&lock=2', { mode: 'navigate' });
  assert(root.intercepted);
  const onlineDocument = 'network:' + scope + '?level=2&lock=2';
  assert.equal(await root.response.text(), onlineDocument);
  const onlineEngine = 'network:' + scope + 'js/engine.js?v=release2';
  assert.equal(await (await worker.dispatch('js/engine.js?v=release2')).response.text(), onlineEngine);
  const entries = [...worker.stores.values()][0];
  assert(entries.has(scope + 'index.html'));
  assert(entries.has(scope + 'js/engine.js'));
  assert(!entries.has(scope + '?level=2&lock=2'));
  assert(!entries.has(scope + 'js/engine.js?v=release2'));
  worker.setNetwork('offline');
  assert.equal(await (await worker.dispatch('./?level=1', { mode: 'navigate' })).response.text(), onlineDocument);
  assert.equal(await (await worker.dispatch('index.html', { mode: 'navigate' })).response.text(), onlineDocument);
  assert.equal(await (await worker.dispatch('js/engine.js')).response.text(), onlineEngine);
  assert.equal((await worker.dispatch('css/style.css')).response.status, 200);
  worker.setNetwork('unavailable');
  assert.equal((await worker.dispatch('./', { mode: 'navigate' })).response.status, 200);
  assert.equal((await worker.dispatch('js/engine.js')).response.status, 200);
  worker.setNetwork('missing');
  assert.equal((await worker.dispatch('js/app.js')).response.status, 404, 'real 404 responses must remain visible');
  assert([...entries.keys()].every(url => url.startsWith(scope) && !url.includes('/api/')));
});

function installHarness(options = {}) {
  const windowListeners = new Map(), mediaListeners = new Map(), elements = new Map(), registrations = [];
  function addListener(collection, type, listener) {
    if (!collection.has(type)) collection.set(type, []);
    collection.get(type).push(listener);
  }
  async function emit(collection, type, event = {}) {
    for (const listener of collection.get(type) || []) await listener(event);
  }
  function element(id) {
    const listeners = new Map(), classes = new Set(['hidden']);
    const value = {
      textContent: '', disabled: false, open: false,
      classList: {
        toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      showModal() { value.open = true; }, close() { value.open = false; },
      addEventListener(type, listener) { addListener(listeners, type, listener); },
      emit(type, event) { return emit(listeners, type, event); }
    };
    elements.set(id, value);
    return value;
  }
  for (const id of ['btn-install', 'install-dialog', 'install-instructions', 'connection-note', 'btn-install-close']) element(id);
  const media = {
    matches: options.standalone || false,
    addEventListener(type, listener) { addListener(mediaListeners, type, listener); }
  };
  const navigator = {
    userAgent: options.userAgent || 'Chrome', platform: options.platform || 'Linux',
    maxTouchPoints: options.maxTouchPoints || 0, standalone: options.appleStandalone || false,
    onLine: options.online !== false,
    serviceWorker: {
      register(url, registrationOptions) {
        registrations.push({ url, options: JSON.parse(JSON.stringify(registrationOptions)) });
        return options.registrationFails ? Promise.reject(new Error('registration failed')) : Promise.resolve({});
      }
    }
  };
  if (options.unsupported) delete navigator.serviceWorker;
  vm.runInNewContext(installSource, {
    document: { getElementById(id) { assert(elements.has(id), 'unexpected element: ' + id); return elements.get(id); } },
    navigator,
    window: {
      isSecureContext: options.secure !== false,
      matchMedia(query) { assert.equal(query, '(display-mode: standalone)'); return media; },
      addEventListener(type, listener) { addListener(windowListeners, type, listener); }
    }
  }, { filename: 'pwa.js' });
  return {
    registrations, navigator, elements,
    button: elements.get('btn-install'), dialog: elements.get('install-dialog'),
    instructions: elements.get('install-instructions'), note: elements.get('connection-note'),
    emit(type, event) { return emit(windowListeners, type, event); },
    async displayMode(matches) { media.matches = matches; await emit(mediaListeners, 'change'); }
  };
}

test('installation prompt dismissal permits retry and appinstalled hides the control', async () => {
  const app = installHarness();
  assert(!app.button.classList.contains('hidden'));
  let prevented = 0, promptCalls = 0, finishChoice;
  const firstChoice = new Promise(resolve => { finishChoice = resolve; });
  await app.emit('beforeinstallprompt', {
    preventDefault() { prevented++; }, async prompt() { promptCalls++; }, userChoice: firstChoice
  });
  const firstClick = app.button.emit('click');
  assert(app.button.disabled, 'button must be disabled while native prompt is active');
  finishChoice({ outcome: 'dismissed' });
  await firstClick;
  assert.equal(prevented, 1);
  assert.equal(promptCalls, 1);
  assert(!app.button.disabled);
  assert(!app.button.classList.contains('hidden'));
  await app.button.emit('click');
  assert(app.dialog.open, 'a consumed prompt must fall back to manual instructions');
  assert.equal(promptCalls, 1, 'a dismissed native prompt must not be reused');
  await app.emit('beforeinstallprompt', {
    preventDefault() { prevented++; }, async prompt() { promptCalls++; },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  });
  await app.button.emit('click');
  assert.equal(promptCalls, 2);
  await app.emit('appinstalled');
  assert(app.button.classList.contains('hidden'));
  assert(!app.dialog.open);
  assert(!app.button.disabled);
  await app.displayMode(false);
  assert(app.button.classList.contains('hidden'), 'installed state must survive display-mode changes');
});

test('failed prompts restore the button and show guidance without breaking future installation', async () => {
  const app = installHarness();
  await app.emit('beforeinstallprompt', {
    preventDefault() {}, async prompt() { throw new Error('prompt unavailable'); },
    userChoice: Promise.resolve({ outcome: 'dismissed' })
  });
  await app.button.emit('click');
  assert(app.dialog.open);
  assert(!app.button.disabled);
  await app.elements.get('btn-install-close').emit('click');
  assert(!app.dialog.open);
  let retryCalls = 0;
  await app.emit('beforeinstallprompt', {
    preventDefault() {}, async prompt() { retryCalls++; },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  });
  await app.button.emit('click');
  assert.equal(retryCalls, 1);
  assert(!app.button.disabled);
});

test('standalone launches hide installation and display-mode changes update the control', async () => {
  assert(installHarness({ standalone: true }).button.classList.contains('hidden'));
  assert(installHarness({ appleStandalone: true }).button.classList.contains('hidden'));
  const app = installHarness();
  await app.displayMode(true);
  assert(app.button.classList.contains('hidden'));
  await app.displayMode(false);
  assert(!app.button.classList.contains('hidden'));
});

test('secure contexts register relative to the mount and insecure/unsupported browsers keep manual guidance', async () => {
  const secure = installHarness();
  assert.deepEqual(secure.registrations, [{ url: 'sw.js', options: { scope: './', updateViaCache: 'none' } }]);
  const insecure = installHarness({ secure: false });
  assert.equal(insecure.registrations.length, 0);
  await insecure.button.emit('click');
  assert(insecure.dialog.open);
  assert.match(insecure.instructions.textContent, /HTTPS/);
  assert.equal(installHarness({ unsupported: true }).registrations.length, 0);
  const failed = installHarness({ registrationFails: true });
  await Promise.resolve();
  await failed.button.emit('click');
  assert(failed.dialog.open, 'registration failure must not break the install guide');
});

test('iPad and iPhone users receive Safari home-screen instructions', async () => {
  for (const options of [
    { userAgent: 'iPhone' },
    { userAgent: 'Mozilla/5.0 Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 5 }
  ]) {
    const app = installHarness(options);
    await app.button.emit('click');
    assert(app.dialog.open);
    assert.match(app.instructions.textContent, /Safari/);
    assert.match(app.instructions.textContent, /공유/);
    assert.match(app.instructions.textContent, /홈 화면에 추가/);
  }
});

test('offline status is visible only while disconnected', async () => {
  const app = installHarness({ online: false });
  assert(!app.note.classList.contains('hidden'));
  app.navigator.onLine = true;
  await app.emit('online');
  assert(app.note.classList.contains('hidden'));
  app.navigator.onLine = false;
  await app.emit('offline');
  assert(!app.note.classList.contains('hidden'));
});
