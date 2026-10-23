// Migration service worker: redirect all navigations to the new host.
const NEW_URL = "https://dispatchsaf.ethantam.dev";

self.addEventListener("install", e => { self.skipWaiting(); });

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.mode === "navigate") {
    e.respondWith(Response.redirect(NEW_URL, 302));
    return;
  }
  // Let everything else fail — we want users to go to the new host.
  e.respondWith(fetch(req).catch(() => new Response("Moved", { status: 302, headers: { Location: NEW_URL } })));
});
