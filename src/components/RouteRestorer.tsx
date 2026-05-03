"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

const STORAGE_KEY = "dash-last-route";

/**
 * Persists the current route to localStorage on every navigation.
 * On initial mount, if we're at "/" (the PWA start_url), redirects to the last visited route.
 */
export function RouteRestorer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Restore on initial mount at "/"
  useEffect(() => {
    if (pathname === "/") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== "/") {
        router.replace(saved);
      }
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist current route on navigation
  useEffect(() => {
    const fullPath = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    if (pathname !== "/login") {
      localStorage.setItem(STORAGE_KEY, fullPath);
    }
  }, [pathname, searchParams]);

  return null;
}
