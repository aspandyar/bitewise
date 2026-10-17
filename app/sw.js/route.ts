import { serviceWorkerSource } from "@/lib/pwa/service-worker";

// no-cache: a new deploy's worker must be picked up on the next visit, not after the HTTP cache
// expires.
export function GET() {
  return new Response(serviceWorkerSource(), {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
