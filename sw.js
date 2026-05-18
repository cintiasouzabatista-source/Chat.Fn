const CACHE_NAME = 'bankday-v4'; // Incrementa pra forçar update
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js' // ADICIONA - tu usa nos gráficos
];

// Instala e cacheia
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto, salvando arquivos...');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('Falha ao cachear:', err))
  );
});

// Ativa e limpa cache antigo
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache First pra arquivos locais, Network First pra CDN
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Ignora requisições de extensão do Chrome
  if (url.protocol === 'chrome-extension:') return;
  
  // Network First pra APIs externas, Cache First pro resto
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request).catch(() => {
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
        })
    );
  }
});
