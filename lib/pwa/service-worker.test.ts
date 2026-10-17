import { describe, expect, it } from "vitest";
import { PWA } from "@/lib/config";
import { serviceWorkerSource } from "./service-worker";

type Listener = (event: Record<string, unknown>) => void;

// Runs the generated worker against fake browser globals, the way a browser would load it.
function loadWorker(network: (request: { url: string }) => Promise<Response>) {
  const listeners: Record<string, Listener> = {};
  const stored = new Map<string, Response>();
  const deleted: string[] = [];
  const caches = {
    open: async () => ({
      addAll: async (urls: string[]) => {
        for (const url of urls) stored.set(url, new Response(`cached ${url}`));
      },
    }),
    match: async (url: string) => stored.get(url),
    keys: async () => ["bitewise-v0", PWA.cacheName],
    delete: async (key: string) => {
      deleted.push(key);
      return true;
    },
  };
  const self = {
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  new Function("self", "caches", "fetch", "Response", serviceWorkerSource())(
    self,
    caches,
    network,
    Response,
  );
  return { listeners, stored, deleted };
}

async function dispatch(listener: Listener | undefined, fields: Record<string, unknown> = {}) {
  let waited: Promise<unknown> | undefined;
  let responded: Promise<Response> | undefined;
  listener?.({
    ...fields,
    waitUntil: (promise: Promise<unknown>) => {
      waited = promise;
    },
    respondWith: (promise: Promise<Response>) => {
      responded = promise;
    },
  });
  await waited;
  return responded;
}

const offline = () => Promise.reject(new TypeError("Failed to fetch"));

describe("service worker", () => {
  it("caches the offline page on install", async () => {
    const worker = loadWorker(offline);
    await dispatch(worker.listeners.install);
    expect(worker.stored.has(PWA.offlinePath)).toBe(true);
  });

  it("drops caches of older versions on activate", async () => {
    const worker = loadWorker(offline);
    await dispatch(worker.listeners.activate);
    expect(worker.deleted).toEqual(["bitewise-v0"]);
  });

  it("answers a failed page navigation with the offline page", async () => {
    const worker = loadWorker(offline);
    await dispatch(worker.listeners.install);
    const response = await dispatch(worker.listeners.fetch, {
      request: { mode: "navigate", url: "/" },
    });
    expect(await (await response!).text()).toBe(`cached ${PWA.offlinePath}`);
  });

  it("passes a working navigation through", async () => {
    const worker = loadWorker(async () => new Response("live"));
    const response = await dispatch(worker.listeners.fetch, {
      request: { mode: "navigate", url: "/" },
    });
    expect(await (await response!).text()).toBe("live");
  });

  it("leaves data, actions and assets alone", async () => {
    const worker = loadWorker(offline);
    for (const mode of ["cors", "same-origin", "no-cors"]) {
      const response = await dispatch(worker.listeners.fetch, {
        request: { mode, url: "/api/foods/search?q=a" },
      });
      expect(response).toBeUndefined();
    }
  });
});
