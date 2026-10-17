import { cookies } from "next/headers";
import { parseAppearance, type Appearance } from "@/lib/appearance";
import { APPEARANCE } from "@/lib/config";

// Request-time: only the appearance screen calls it, inside its <Suspense> boundary.
export async function getAppearance(): Promise<Appearance> {
  const store = await cookies();
  return parseAppearance({
    theme: store.get(APPEARANCE.cookies.theme)?.value,
    accent: store.get(APPEARANCE.cookies.accent)?.value,
  });
}
