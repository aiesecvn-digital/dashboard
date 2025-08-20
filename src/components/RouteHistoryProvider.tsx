"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type RouteHistory = {
  previousPathname: string | null;
  currentPathname: string;
};

const RouteHistoryContext = createContext<RouteHistory | null>(null);

export function useRouteHistory(): RouteHistory {
  const context = useContext(RouteHistoryContext);
  if (!context) {
    return { previousPathname: null, currentPathname: "" };
  }
  return context;
}

export default function RouteHistoryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [history, setHistory] = useState<RouteHistory>({
    previousPathname: null,
    currentPathname: pathname,
  });

  useEffect(() => {
    setHistory(prev => ({
      previousPathname: prev.currentPathname,
      currentPathname: pathname,
    }));
  }, [pathname]);

  const value = useMemo(() => history, [history]);

  return (
    <RouteHistoryContext.Provider value={value}>
      {children}
    </RouteHistoryContext.Provider>
  );
}


