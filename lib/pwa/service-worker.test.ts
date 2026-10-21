import { describe, expect, it } from "vitest";
import { PWA } from "@/lib/config";
import { pwaIconUrl, pwaIcons } from "./icons";
import { cacheNameFor, currentCacheName, serviceWorkerSource } from "./service-worker";

type Listener = (event: Record<string, unknown>) => void;

// Node's Request rejects the relative URLs a worker uses; this keeps what the worker passes.
class FakeRequest {
  constructor(
    readonly url: string,
    readonly init: { cache?: string } = {},
  ) {}
  get cache() {
    return this.init.cache;
  }
}

// Runs the generated worker against fake browser globals, the way a browser would load it.
function loadWorker(network: (request: { url: string }) => Promise<Response>) {
  const listeners: Record<string, Listener> = {};
  const stored = new Map<string, Response>();
  const reloaded: string[] = [];
  const deleted: string[] = [];
  const caches = {
    open: async () => ({
      addAll: async (requests: FakeRequest[]) => {
        for (const { url, cache } of requests) {
          stored.set(url, new Response(`cached ${url}`));
          if (cache === "reload") reloaded.push(url);
        }
      },
    }),
    match: async (url: string) => stored.get(url),
    keys: async () => ["bitewise-v0", currentCacheName()],
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
  new Function("self", "caches", "fetch", "Response", "Request", serviceWorkerSource())(
    self,
    caches,
    network,
    Response,
    FakeRequest,
  );
  return { listeners, stored, reloaded, deleted };
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

  it("precaches past the HTTP cache, so a new worker never stores a stale copy", async () => {
    const worker = loadWorker(offline);
    await dispatch(worker.listeners.install);
    expect(worker.reloaded).toContain(PWA.offlinePath);
  });

  it("answers a precached icon from the cache when there is no network", async () => {
    const worker = loadWorker(offline);
    await dispatch(worker.listeners.install);
    const icon = pwaIconUrl(pwaIcons()[0]!);
    const response = await dispatch(worker.listeners.fetch, {
      request: { mode: "no-cors", url: `https://bitewise.test${icon}` },
    });
    expect(await (await response!).text()).toBe(`cached ${icon}`);
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
        request: { mode, url: "https://bitewise.test/api/foods/search?q=a" },
      });
      expect(response).toBeUndefined();
    }
  });
});

describe("cacheNameFor", () => {
  it("changes whenever what the worker precaches changes (#96)", () => {
    expect(cacheNameFor(["<html>a</html>"])).not.toBe(cacheNameFor(["<html>b</html>"]));
  });

  it("is stable for the same content and keeps the app's prefix", () => {
    expect(cacheNameFor(["x"])).toBe(cacheNameFor(["x"]));
    expect(cacheNameFor(["x"]).startsWith(`${PWA.cachePrefix}-`)).toBe(true);
  });
});
