import { PWA } from "@/lib/config";
import { pwaIconUrl, pwaIcons } from "./icons";

// Only page navigations are touched. Data, server actions and hashed JS/CSS go straight to the
// network: the browser caches immutable assets itself, and a second cache here is how a stale
// version outlives a deploy.
export function serviceWorkerSource(): string {
  const cacheName = JSON.stringify(PWA.cacheName);
  const offline = JSON.stringify(PWA.offlinePath);
  const precache = JSON.stringify([PWA.offlinePath, ...pwaIcons().map(pwaIconUrl)]);
  return `"use strict";
const CACHE = ${cacheName};
const OFFLINE = ${offline};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(${precache})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE).then((page) => page || Response.error())));
});
`;
}
