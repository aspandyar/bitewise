import { BARCODE } from "@/lib/config";
import type { BarcodeLookupBody } from "./barcode-lookup";
import { scanTargetHref, type ScanTarget } from "./scan";

// The permission prompt can stay up for seconds; if the scanner was closed meanwhile, the
// stream that arrives late is stopped here, or the camera light would stay on with no screen.
export async function openCamera(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  isStopped: () => boolean,
): Promise<MediaStream | null> {
  const stream = await getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
  if (!isStopped()) return stream;
  stream.getTracks().forEach((track) => track.stop());
  return null;
}

export type LookupOutcome =
  | { kind: "navigate"; href: string }
  | { kind: "unavailable"; code: string }
  | { kind: "failed"; reason: "rate_limited" | "unauthorized" | "other" }
  | { kind: "aborted" };

// Aborted once the scanner closes: an answer arriving after "Закрыть" or Back must not navigate.
export async function lookupBarcode(
  code: string,
  target: ScanTarget,
  deps: { fetch: typeof fetch; signal: AbortSignal; typed?: boolean },
): Promise<LookupOutcome> {
  // Called unbound: as deps.fetch(...) a browser's window.fetch throws "Illegal invocation".
  const { fetch: send, signal } = deps;
  const params = new URLSearchParams({ code });
  if (deps.typed) params.set(BARCODE.typedParam, "1");
  try {
    const response = await send(`/api/foods/barcode?${params}`, { signal });
    const body = (await response.json()) as BarcodeLookupBody;
    if (signal.aborted) return { kind: "aborted" };
    const href = scanTargetHref(body, target);
    if (href) return { kind: "navigate", href };
    if ("status" in body && body.status === "unavailable")
      return { kind: "unavailable", code: body.code };
    if ("error" in body && (body.error === "rate_limited" || body.error === "unauthorized")) {
      return { kind: "failed", reason: body.error };
    }
    return { kind: "failed", reason: "other" };
  } catch {
    return signal.aborted ? { kind: "aborted" } : { kind: "failed", reason: "other" };
  }
}
