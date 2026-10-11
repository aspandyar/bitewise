"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TIME_ZONE_COOKIE } from "@/lib/config";

// The server cannot know the device's zone, so the browser reports it once and re-renders.
// IANA names hold only letters, digits, "_", "+", "-" and "/", all valid in a cookie value.
export function TimeZoneCookie() {
  const router = useRouter();
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const prefix = `${TIME_ZONE_COOKIE.name}=`;
    const current = document.cookie
      .split("; ")
      .find((item) => item.startsWith(prefix))
      ?.slice(prefix.length);
    if (current === zone) return;
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${prefix}${zone}; path=/; max-age=${TIME_ZONE_COOKIE.maxAgeSec}; samesite=lax${secure}`;
    router.refresh();
  }, [router]);
  return null;
}
