import { ImageResponse } from "next/og";
import { BiteMark } from "@/components/brand/bite-mark";
import { PWA } from "@/lib/config";
import { pwaIcons } from "@/lib/pwa/icons";

// Rendered at build time for the listed files; anything else is not an icon.
export function generateStaticParams() {
  return pwaIcons().map((icon) => ({ file: icon.file }));
}

export async function GET(_request: Request, { params }: RouteContext<"/pwa-icons/[file]">) {
  const { file } = await params;
  const icon = pwaIcons().find((item) => item.file === file);
  if (!icon) return new Response(null, { status: 404 });
  const scale = icon.purpose === "maskable" ? PWA.maskableScale : 1;
  return new ImageResponse(<BiteMark size={icon.size} scale={scale} />, {
    width: icon.size,
    height: icon.size,
  });
}
