// Bump VERSION whenever you change a file, so phones pick up the update.
const VERSION = "bag-v8";
const SHELL = [
    "./",
    "./index.html",
    "./styles.css",
    "./data.js",
    "./app.js",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
    e.waitUntil(
        (async () => {
            const cache = await caches.open(VERSION);
            await cache.addAll(SHELL);
            for (const manifestUrl of [
                "./audio/manifest.json",
                "./emoji/manifest.json",
            ]) {
                try {
                    const res = await fetch(manifestUrl);
                    if (res.ok) {
                        const files = await res.json();
                        await cache.addAll(files);
                    }
                } catch (_) {}
            }
            self.skipWaiting();
        })(),
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== VERSION)
                        .map((k) => caches.delete(k)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

// Cache-first, then network (stores Google Fonts, emoji SVGs, and audio clips offline).
self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;
    e.respondWith(
        caches.match(e.request).then(
            (hit) =>
                hit ||
                fetch(e.request)
                    .then((res) => {
                        if (res && (res.ok || res.type === "opaque")) {
                            const copy = res.clone();
                            caches
                                .open(VERSION)
                                .then((c) => c.put(e.request, copy));
                        }
                        return res;
                    })
                    .catch(() => caches.match("./index.html")),
        ),
    );
});
