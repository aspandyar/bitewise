import { createHash } from "node:crypto";
import { PWA } from "@/lib/config";
import { pwaIconUrl, pwaIcons } from "./icons";
import { offlinePageHtml } from "./offline-page";

export function cacheNameFor(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return `${PWA.cachePrefix}-${hash.digest("hex").slice(0, PWA.cacheHashLength)}`;
}

function iconUrls(): string[] {
  return pwaIcons().map(pwaIconUrl);
}

// Derived from what the worker stores, so a new offline text or palette ships a new cache with no
// one remembering to bump a version (#96). Icons are drawn from these settings and the bite mark;
// a change to the mark's shapes alone still needs a settings change to reach installed copies.
export function currentCacheName(): string {
  const { brandColor, markColor, iconSizes, maskableScale } = PWA;
  return cacheNameFor([
    offlinePageHtml(),
    JSON.stringify(iconUrls()),
    JSON.stringify({ brandColor, markColor, iconSizes, maskableScale }),
  ]);
}

// Only page navigations and the precached icons are touched. Data, server actions and hashed
// JS/CSS go straight to the network: the browser caches immutable assets itself, and a second
// cache here is how a stale version outlives a deploy. Precaching asks with cache: "reload", so
// an HTTP-cached copy of the old offline page never lands in the new cache.
export function serviceWorkerSource(): string {
  const cacheName = JSON.stringify(currentCacheName());
  const offline = JSON.stringify(PWA.offlinePath);
  const icons = JSON.stringify(iconUrls());
  return `"use strict";
const CACHE = ${cacheName};
const OFFLINE = ${offline};
const ICONS = ${icons};
self.addEventListener("install", (event) => {
  const requests = [OFFLINE, ...ICONS].map((url) => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(requests)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE).then((page) => page || Response.error())));
    return;
  }
  const path = new URL(event.request.url).pathname;
  if (ICONS.indexOf(path) < 0) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(path).then((icon) => icon || Response.error())));
});
`;
}
