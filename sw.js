const CACHE_NAME = 'cropper-static-v10';
const APP_SHELL = [
  './',
  './index.html',
  './watermark.html',
  './styles.css',
  './app.js',
  './watermark.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './vendor/jszip.min.js',
  './vendor/lucide.min.js',
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/onnxruntime/ort.min.js',
  './vendor/onnxruntime/ort-wasm-simd.wasm',
  './vendor/onnxruntime/ort-wasm.wasm',
  './vendor/tesseract-core/tesseract-core.js',
  './vendor/tesseract-core/tesseract-core.wasm',
  './vendor/tesseract-core/tesseract-core.wasm.js',
  './vendor/tesseract-core/tesseract-core-lstm.js',
  './vendor/tesseract-core/tesseract-core-lstm.wasm',
  './vendor/tesseract-core/tesseract-core-lstm.wasm.js',
  './vendor/tesseract-core/tesseract-core-simd.js',
  './vendor/tesseract-core/tesseract-core-simd.wasm',
  './vendor/tesseract-core/tesseract-core-simd.wasm.js',
  './vendor/tesseract-core/tesseract-core-simd-lstm.js',
  './vendor/tesseract-core/tesseract-core-simd-lstm.wasm',
  './vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract-lang/4.0.0/eng.traineddata.gz',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const appShellRequest = url.origin === self.location.origin
    && (/\.(html|css|js)$/).test(url.pathname);

  if (appShellRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
