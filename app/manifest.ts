import type { MetadataRoute } from "next";
import { PWA } from "@/lib/config";
import { ru } from "@/lib/i18n/ru";
import { pwaIconUrl, pwaIcons } from "@/lib/pwa/icons";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: ru.app.name,
    short_name: ru.app.name,
    description: ru.app.description,
    lang: "ru",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: PWA.brandColor,
    theme_color: PWA.brandColor,
    icons: pwaIcons().map((icon) => ({
      src: pwaIconUrl(icon),
      sizes: `${icon.size}x${icon.size}`,
      type: "image/png",
      purpose: icon.purpose,
    })),
  };
}
