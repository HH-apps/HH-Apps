// Thailanda HQ – funcționează și offline.
// Paginile aplicației: întâi rețeaua, iar dacă nu e net, copia salvată.
// /api/state nu se salvează aici: datele comune le ține aplicația în telefon.
const CACHE = "thq-v2";
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "img/horatiu.jpg", "img/cristina.jpg",
  "ghid/bangkok.html", "ghid/phuket.html", "ghid/pregatire.html",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.includes("/api/")) return;

  // Leaflet și hărțile din ghiduri: salvate pe măsură ce le deschidem
  const isExtra = url.origin !== location.origin && /unpkg\.com|basemap\.cartocdn\.com/.test(url.hostname);
  if (url.origin !== location.origin && !isExtra) return;

  e.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
