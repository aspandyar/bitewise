import { PWA } from "@/lib/config";

export type PwaIcon = { file: string; size: number; purpose: "any" | "maskable" };

export function pwaIcons(): PwaIcon[] {
  return PWA.iconSizes.flatMap((size) =>
    (["any", "maskable"] as const).map((purpose) => ({
      file: `${purpose}-${size}.png`,
      size,
      purpose,
    })),
  );
}

export function pwaIconUrl(icon: PwaIcon): string {
  return `${PWA.iconsPath}/${icon.file}`;
}
