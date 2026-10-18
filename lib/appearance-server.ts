import { headers } from "next/headers";
import { readAppearanceCookie, type Appearance } from "@/lib/appearance";

// Request-time: only the appearance screen calls it, inside its <Suspense> boundary. Reads the raw
// header rather than cookies(), which keeps the last of repeated names while the head script keeps
// the first.
export async function getAppearance(): Promise<Appearance> {
  return readAppearanceCookie((await headers()).get("cookie") ?? "");
}
