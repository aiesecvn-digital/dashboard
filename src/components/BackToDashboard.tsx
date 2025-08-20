"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useRouteHistory } from "./RouteHistoryProvider";

export default function BackToDashboard() {
  const router = useRouter();
  const { previousPathname, currentPathname } = useRouteHistory();

  const shouldShow = Boolean(
    previousPathname &&
      previousPathname.startsWith("/dashboard") &&
      currentPathname !== "/dashboard"
  );

  if (!shouldShow) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/dashboard")}
      className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground shadow hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Back to dashboard"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M9.53 4.47a.75.75 0 010 1.06L5.81 9.25H20a.75.75 0 010 1.5H5.81l3.72 3.72a.75.75 0 11-1.06 1.06l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 011.06 0z" clipRule="evenodd" />
      </svg>
      Back to Dashboard
    </button>
  );
}


