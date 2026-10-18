import { ImageResponse } from "next/og";
import { BiteMark } from "@/components/brand/bite-mark";
import { PWA } from "@/lib/config";

export const size = { width: PWA.appleIconSize, height: PWA.appleIconSize };
export const contentType = "image/png";

// iOS rounds the corners itself, so the square stays full-bleed.
export default function AppleIcon() {
  return new ImageResponse(<BiteMark size={PWA.appleIconSize} />, size);
}
