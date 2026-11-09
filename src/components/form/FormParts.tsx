"use client";

/**
 * Shared building blocks for the step-by-step forms (help request, volunteer application).
 * Calm by design (PRD §3): soft cards, blue-toned errors (never red), large tap targets.
 */
import { forwardRef, useEffect, useRef, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, LogOut, Send, type LucideIcon } from "lucide-react";

export function StepProgress({
  label,
  current,
  total,
  exitLabel,
  onExit,
}: {
  label: string;
  current: number;
  total: number;
  exitLabel: string;
  onExit: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-ink-soft" aria-live="polite">
          {label}
        </p>
        <button type="button" onClick={onExit} className="pill text-ink-soft hover:bg-surface-soft hover:text-ink">
          <LogOut aria-hidden className="size-4 rtl:-scale-x-100" />
          {exitLabel}
        </button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-soft" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </>
  );
}

export function StepHeading({
  headingRef,
  title,
  hint,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  hint?: string;
}) {
  return (
    <div>
      <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-semibold leading-tight text-ink outline-none sm:text-4xl">
        {title}
      </h1>
      {hint && <p className="mt-3 text-lg text-ink-soft">{hint}</p>}
    </div>
  );
}

/** Back on the start side, Continue / Send on the end side. */
export function StepNav({
  showBack,
  onBack,
  isLast,
  sending,
  labels,
}: {
  showBack: boolean;
  onBack: () => void;
  isLast: boolean;
  sending: boolean;
  labels: { back: string; next: string; send: string; sending: string };
}) {
  return (
    <div className="mt-10 flex items-center justify-between gap-4">
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          className="pill px-5 py-3 text-base text-ink-soft hover:bg-surface-soft hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
          {labels.back}
        </button>
      ) : (
        <span />
      )}
      <button
        type="submit"
        disabled={sending}
        className="pill bg-primary px-7 py-3.5 text-lg text-primary-ink shadow-soft hover:bg-primary-hover disabled:opacity-70"
      >
        {isLast ? (
          sending ? (
            <>
              <LoaderCircle aria-hidden className="size-5 animate-spin" />
              {labels.sending}
            </>
          ) : (
            <>
              {labels.send}
              <Send aria-hidden className="size-5 rtl:-scale-x-100" />
            </>
          )
        ) : (
          <>
            {labels.next}
            <ArrowRight aria-hidden className="size-5 rtl:-scale-x-100" />
          </>
        )}
      </button>
    </div>
  );
}

/** "Leave the form?" confirmation. The native <dialog> traps focus and closes on Escape. */
export const ExitDialog = forwardRef<
  HTMLDialogElement,
  { title: string; body: string; stay: string; leave: string; onLeave: () => void }
>(function ExitDialog({ title, body, stay, leave, onLeave }, ref) {
  const close = () => (ref && "current" in ref ? ref.current?.close() : undefined);
  return (
    <dialog
      ref={ref}
      aria-labelledby="exit-title"
      className="m-auto w-[min(26rem,calc(100%-2.5rem))] rounded-3xl bg-surface p-7 text-ink shadow-lifted backdrop:bg-black/30"
    >
      <h2 id="exit-title" className="text-xl font-semibold">
        {title}
      </h2>
      <p className="mt-3 text-ink-soft">{body}</p>
      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          autoFocus
          onClick={close}
          className="pill bg-primary px-5 py-3 text-base text-primary-ink hover:bg-primary-hover"
        >
          {stay}
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="pill bg-surface-soft px-5 py-3 text-base text-ink hover:shadow-soft"
        >
          {leave}
        </button>
      </div>
    </dialog>
  );
});

/** Large tappable option. A visually hidden native input keeps keyboard and screen reader support. */
export function ChoiceCard({
  type,
  value,
  registration,
  Icon,
  title,
  body,
  compact = false,
}: {
  type: "checkbox" | "radio";
  value: string;
  registration: UseFormRegisterReturn;
  Icon?: LucideIcon;
  title: ReactNode;
  body?: string;
  compact?: boolean;
}) {
  return (
    <label className="relative block cursor-pointer">
      <input type={type} value={value} {...registration} className="peer sr-only" />
      <span
        className={`flex h-full items-start gap-4 rounded-3xl bg-surface shadow-soft ring-2 ring-transparent transition-shadow hover:shadow-lifted peer-checked:bg-primary-soft peer-checked:ring-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] ${
          compact ? "p-4 pe-10" : "p-5"
        }`}
      >
        {Icon && (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary-soft">
            <Icon aria-hidden className="size-6 text-secondary" strokeWidth={1.75} />
          </span>
        )}
        <span className="flex-1 self-center">
          <span className={`block font-medium text-ink ${compact ? "text-base" : "text-lg"}`}>{title}</span>
          {body && <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{body}</span>}
        </span>
      </span>
      <span
        aria-hidden
        className="absolute end-3 top-3 hidden size-6 items-center justify-center rounded-full bg-primary text-primary-ink peer-checked:flex"
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
    </label>
  );
}

/** Single consent checkbox in a soft card. */
export function AgreeCheckbox({
  registration,
  label,
  invalid,
}: {
  registration: UseFormRegisterReturn;
  label: ReactNode;
  invalid?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-3xl bg-surface p-5 shadow-soft">
      <input type="checkbox" {...registration} className="peer sr-only" aria-invalid={invalid} />
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-transparent ring-2 ring-line peer-checked:bg-primary peer-checked:text-primary-ink peer-checked:ring-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]"
      >
        <Check className="size-5" strokeWidth={3} />
      </span>
      <span className="text-ink">{label}</span>
    </label>
  );
}

export function TextField({
  label,
  hint,
  badge,
  error,
  registration,
  ...input
}: {
  label: string;
  hint?: ReactNode;
  badge?: string;
  error?: string;
  registration: UseFormRegisterReturn;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  const id = registration.name;
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 font-medium text-ink">
        {label}
        {badge && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-ink">{badge}</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-soft">
          {hint}
        </p>
      )}
      <input
        id={id}
        {...registration}
        {...input}
        aria-invalid={!!error}
        aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
        className="mt-2 w-full rounded-2xl bg-surface px-4 py-3.5 text-lg text-ink shadow-soft outline-none ring-1 ring-line placeholder:text-ink-soft/60 focus:ring-2 focus:ring-secondary aria-invalid:ring-2 aria-invalid:ring-secondary"
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  registration,
  maxLength,
  count,
  counterLabel,
  rows = 4,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  registration: UseFormRegisterReturn;
  maxLength: number;
  count: number;
  counterLabel: string;
  rows?: number;
}) {
  const id = registration.name;
  return (
    <div>
      <label htmlFor={id} className="block font-medium text-ink">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-secondary">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        rows={rows}
        maxLength={maxLength}
        {...registration}
        aria-invalid={!!error}
        aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
        className="mt-3 w-full resize-y rounded-2xl bg-surface px-4 py-3 text-ink shadow-soft outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary"
      />
      <p className="mt-1 text-end text-sm text-ink-soft" aria-live="polite">
        {counterLabel.replace("{count}", String(count))}
      </p>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Gentle inline error: blue-toned, never red (PRD §3). */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-sm font-medium text-secondary">
      {message}
    </p>
  );
}

/** Calm notice box, used for send errors and info. */
export function Notice({ children, role }: { children: ReactNode; role?: "alert" | "status" }) {
  return (
    <p role={role} className="rounded-2xl bg-secondary-soft p-4 text-ink">
      {children}
    </p>
  );
}

/** Reads a nested react-hook-form error message by field path. */
export function errorMessageAt(errors: unknown, path: string): string | undefined {
  const entry = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], errors) as
    | { message?: string }
    | undefined;
  return entry?.message;
}

/**
 * Returns a ref for the step heading. When `key` changes (new step or final screen),
 * scrolls to the top and moves focus to the heading so screen readers announce it.
 */
export function useStepFocus(key: unknown) {
  const ref = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    ref.current?.focus();
  }, [key]);
  return ref;
}
