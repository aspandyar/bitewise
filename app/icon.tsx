import { ImageResponse } from "next/og";
import { BiteMark } from "@/components/brand/bite-mark";
import { PWA } from "@/lib/config";

export const size = { width: PWA.faviconSize, height: PWA.faviconSize };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BiteMark size={PWA.faviconSize} />, size);
}
