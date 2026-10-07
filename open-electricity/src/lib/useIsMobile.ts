"use client";

import { useState, useEffect } from "react";

/**
 * Hook to detect whether the current viewport is mobile (< 768px).
 * Safely defaults to false during SSR to avoid hydration mismatch,
 * then updates upon mounting in browser.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
}
