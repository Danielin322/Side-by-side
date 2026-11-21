"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps a sideways-scrolling tab row and, on load, scrolls the current tab (aria-current) into view,
 * so on narrow screens the selected tab isn't hidden past the edge.
 */
export function ScrollToCurrent({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = ref.current;
    const current = row?.querySelector<HTMLElement>("[aria-current]");
    if (!row || !current) return;
    // Only the row scrolls (scrollIntoView would also scroll the page).
    const r = row.getBoundingClientRect();
    const c = current.getBoundingClientRect();
    if (c.left < r.left) row.scrollLeft -= r.left - c.left;
    else if (c.right > r.right) row.scrollLeft += c.right - r.right;
  }, []);
  return (
    <nav ref={ref} aria-label={label} className={className}>
      {children}
    </nav>
  );
}
