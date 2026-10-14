"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { timeZoneCookieToSet } from "@/lib/diary/time-zone";

// The server cannot know the device's zone, so the browser reports it once and re-renders.
export function TimeZoneCookie() {
  const router = useRouter();
  useEffect(() => {
    const cookie = timeZoneCookieToSet(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      document.cookie,
      { https: window.location.protocol === "https:" },
    );
    if (cookie === null) return;
    document.cookie = cookie;
    router.refresh();
  }, [router]);
  return null;
}
