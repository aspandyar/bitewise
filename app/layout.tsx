import type { Metadata, Viewport } from "next";
import { ru } from "@/lib/i18n/ru";
import "./globals.css";

export const metadata: Metadata = {
  title: ru.app.name,
  description: ru.app.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
