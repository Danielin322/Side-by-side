"use client";

import type { ReactNode } from "react";

/** GET form for the log filters that submits as soon as a dropdown changes. */
export function LogFilterForm({ children, label }: { children: ReactNode; label: string }) {
  return (
    <form
      method="get"
      role="search"
      aria-label={label}
      className="flex flex-wrap items-end gap-3"
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
