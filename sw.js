const CACHE_NAME = 'bankday-v3'; // Mudei para v3 para forçar a limpeza do cache antigo
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Instala e cacheia apenas o que é garantido
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto, salvando arquivos estáticos...');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('Falha ao cachear arquivos essenciais:', err))
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

// Intercepta requests com estratégia de Cache First (ou Network para externos)
self.addEventListener('fetch', event => {
  // Se for o Tailwind, não tentamos buscar no cache para evitar erro de CORS no SW
  if (event.request.url.includes('tailwindcss.com')) {
    return; // Deixa o navegador lidar normalmente fora do Service Worker
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna o cache ou tenta buscar na rede
        return response || fetch(event.request).catch(() => {
          // Se estiver offline e for navegação, retorna o index.html
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
