"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";

// cacheComponents keeps screens the user left alive but hidden (React Activity), with their state.
// Hiding runs effect cleanups, so bumping the key there hands the next visit a fresh subtree:
// half-typed values and the errors they caused do not come back.
export function ResetOnHide({ children }: { children: ReactNode }) {
  const [visit, setVisit] = useState(0);
  useEffect(() => () => setVisit((current) => current + 1), []);
  return <Fragment key={visit}>{children}</Fragment>;
}
