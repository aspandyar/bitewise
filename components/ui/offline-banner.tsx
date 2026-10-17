"use client";

import { useOffline } from "next/offline";
import { ru } from "@/lib/i18n/ru";

// Always mounted, like the toast host: screen readers announce a change inside an existing region.
export function OfflineBanner() {
  const offline = useOffline();
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-2"
    >
      {offline ? (
        <p className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          {ru.offline.banner}
        </p>
      ) : null}
    </div>
  );
}
