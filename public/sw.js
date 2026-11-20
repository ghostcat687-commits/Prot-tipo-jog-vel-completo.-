/**
 * Service worker do Bubble Studio.
 *
 * Estratégia deliberadamente conservadora para não quebrar o servidor de
 * desenvolvimento (HMR):
 *  - requisições internas do Vite (/@vite, /@id, /src, /node_modules) e
 *    qualquer URL com timestamp NUNCA são interceptadas;
 *  - navegação: rede primeiro, com a página offline como reserva;
 *  - ícones/manifesto: cache primeiro com atualização em segundo plano.
 *
 * Em produção o mesmo arquivo entrega a interface sem internet.
 */

const CACHE = 'bubble-studio-v1';
const PRECACHE = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isDevAsset(url) {
  return (
    /^\/(@vite|@id|@fs|src|node_modules)\//.test(url.pathname) ||
    url.searchParams.has('t') ||
    url.searchParams.has('import')
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isDevAsset(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html').then((hit) => hit || Response.error())),
    );
    return;
  }

  if (/\.(png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        });
      }),
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
