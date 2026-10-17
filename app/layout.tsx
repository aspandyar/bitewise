import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppearanceSync } from "@/components/appearance-sync";
import { PwaClient } from "@/components/pwa/pwa-client";
import { TimeZoneCookie } from "@/components/time-zone-cookie";
import { ToastHost } from "@/components/ui/toast";
import { appearanceCss, appearanceScript, themeColorViewport } from "@/lib/appearance";
import { ru } from "@/lib/i18n/ru";
import "./globals.css";

export const metadata: Metadata = {
  title: ru.app.name,
  description: ru.app.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: themeColorViewport(),
};

// suppressHydrationWarning: the head script sets data-theme/data-accent on <html> before React
// hydrates, so the attributes differ from the server render on purpose.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Built from config, not user input: the palette and the list of accepted cookie values. */}
        <style dangerouslySetInnerHTML={{ __html: appearanceCss() }} />
        <script dangerouslySetInnerHTML={{ __html: appearanceScript() }} />
      </head>
      <body className="flex min-h-full flex-col">
        <AppearanceSync />
        <PwaClient />
        <TimeZoneCookie />
        {children}
        {/* Reads the URL at request time, so it waits behind its own boundary. */}
        <Suspense fallback={null}>
          <ToastHost />
        </Suspense>
      </body>
    </html>
  );
}
