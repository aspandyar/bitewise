"use client";

import { useEffect } from "react";
import { requestUserCookie } from "@/lib/request-id";

function writeCookie(userId: string | null) {
  document.cookie = requestUserCookie(userId, { https: window.location.protocol === "https:" });
}

// Tells stampRequestId who is signed in, so a form replayed later under another session is
// refused by the server (#107). A cookie, not tab memory: every tab stamps the latest session,
// and only a replay still carries the old one.
export function RequestUserMark({ userId }: { userId: string | null }) {
  useEffect(() => writeCookie(userId), [userId]);
  return null;
}
