"use client";

import { useEffect } from "react";
import { setRequestUser } from "@/lib/request-id";

// Tells stampRequestId whose page this is, so a form replayed later under another session is
// refused by the server (#107). The id is the viewer's own and goes nowhere but their requests.
export function RequestUserMark({ userId }: { userId: string | null }) {
  useEffect(() => {
    setRequestUser(userId);
  }, [userId]);
  return null;
}
