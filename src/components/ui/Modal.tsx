"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Calm modal on the native <dialog> (focus trap, Escape to close). Controlled by `open`. */
export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100%-2.5rem))] rounded-3xl bg-surface p-7 text-ink shadow-lifted backdrop:bg-black/30"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label={closeLabel} className="rounded-full p-1.5 text-ink-soft hover:bg-surface-soft">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="mt-5">{open && children}</div>
    </dialog>
  );
}
