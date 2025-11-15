self.addEventListener("install", e => {
    console.log("ServiceWorker installiert.");
    self.skipWaiting();
});

self.addEventListener("activate", e => {
    console.log("ServiceWorker aktiviert.");
    clients.claim();
});

self.addEventListener("fetch", e => {
    e.respondWith(
        caches.open("pcb-cache-v1").then(cache => {
            return cache.match(e.request).then(resp => {
                const fetchPromise = fetch(e.request).then(networkResp => {
                    cache.put(e.request, networkResp.clone());
                    return networkResp;
                });
                return resp || fetchPromise;
            });
        })
    );
});
