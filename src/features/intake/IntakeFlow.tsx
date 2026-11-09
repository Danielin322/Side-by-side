"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useForm, type FieldPath, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarCheck,
  Check,
  CircleCheck,
  FolderOpen,
  HandHeart,
  Keyboard,
  Lightbulb,
  LoaderCircle,
  LogOut,
  MapPin,
  Phone,
  PhoneCall,
  Send,
  ThumbsUp,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import {
  LANGUAGES,
  LANGUAGE_NAMES,
  MEETING_MODES,
  SUPPORT_TYPES,
  intakeSchema,
  type IntakeValues,
  type MeetingMode,
  type SupportType,
} from "./schema";
import { submitHelpRequest } from "./actions";

const SUPPORT_ICONS: Record<SupportType, LucideIcon> = {
  documents: FolderOpen,
  rights: Lightbulb,
  co_typing: Keyboard,
  scheduling: CalendarCheck,
  calls: PhoneCall,
  accompaniment: HandHeart,
  follow_up: BellRing,
};

const MEETING_ICONS: Record<MeetingMode, LucideIcon> = {
  in_person: MapPin,
  video: Video,
  phone: Phone,
  any: ThumbsUp,
};

type StepId = "support" | "meeting" | "city" | "language" | "note" | "details" | "agree";

/** Fields validated before leaving each step. */
const STEP_FIELDS: Record<StepId, FieldPath<IntakeValues>[]> = {
  support: ["supportTypes"],
  meeting: ["meetingMode"],
  city: ["city"],
  language: ["language"],
  note: ["note"],
  details: ["firstName", "lastName", "phone", "email"],
  agree: ["scopeAgreed"],
};

type Status = "idle" | "done" | "failed" | "unavailable";

/** One-question-per-screen help request form (PRD §3: zero friction, calm Exit on every step). */
export function IntakeFlow() {
  const t = useTranslations("intake");
  const locale = useLocale();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [sending, startSending] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const exitRef = useRef<HTMLDialogElement>(null);
  const firstRender = useRef(true);

  const {
    register,
    trigger,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(intakeSchema),
    mode: "onTouched",
    defaultValues: {
      supportTypes: [],
      city: "",
      note: "",
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    },
  });

  const meetingMode = watch("meetingMode");
  const noteLength = watch("note")?.length ?? 0;
  const steps: StepId[] = [
    "support",
    "meeting",
    ...(meetingMode === "in_person" ? (["city"] as const) : []),
    "language",
    "note",
    "details",
    "agree",
  ];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex === steps.length - 1;

  // Move focus to the new question so screen readers announce it, and start at the top.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [stepIndex, status]);

  async function next() {
    if (await trigger(STEP_FIELDS[step], { shouldFocus: true })) setStepIndex((i) => i + 1);
  }

  const send = handleSubmit((values) => {
    startSending(async () => {
      const result = await submitHelpRequest(values, locale);
      if (result.ok) setStatus("done");
      else setStatus(result.reason === "unavailable" ? "unavailable" : "failed");
    });
  });

  const error = (field: FieldPath<IntakeValues>) => {
    const message = field.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], errors) as
      | { message?: string }
      | undefined;
    return message?.message ? t(`errors.${message.message}` as Parameters<typeof t>[0]) : undefined;
  };

  if (status === "done") {
    return (
      <section className="container-page max-w-2xl py-16 text-center sm:py-24">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary-soft">
          <CircleCheck aria-hidden className="size-10 text-primary" strokeWidth={1.75} />
        </span>
        <h1 ref={headingRef} tabIndex={-1} className="mt-8 text-3xl font-semibold text-ink outline-none sm:text-4xl">
          {t("done.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-ink-soft">{t("done.body")}</p>
        <Link href={routes.home} className="btn-secondary mt-10">
          {t("done.home")}
        </Link>
      </section>
    );
  }

  return (
    <section className="container-page max-w-2xl py-8 sm:py-12">
      {/* Progress and Exit */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-ink-soft" aria-live="polite">
          {t("progress", { current: stepIndex + 1, total: steps.length })}
        </p>
        <button
          type="button"
          onClick={() => exitRef.current?.showModal()}
          className="pill text-ink-soft hover:bg-surface-soft hover:text-ink"
        >
          <LogOut aria-hidden className="size-4 rtl:-scale-x-100" />
          {t("exit")}
        </button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-soft" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (isLast) send();
          else next();
        }}
        className="mt-10"
      >
        <StepHeading headingRef={headingRef} title={t(`${step}.title`)} hint={stepHint(step, t)} />

        <div className="mt-8">
          {step === "support" && (
            <fieldset>
              <legend className="sr-only">{t("support.title")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {SUPPORT_TYPES.map((value) => (
                  <ChoiceCard
                    key={value}
                    type="checkbox"
                    value={value}
                    registration={register("supportTypes")}
                    Icon={SUPPORT_ICONS[value]}
                    title={t(`support.options.${value}.title`)}
                    body={t(`support.options.${value}.body`)}
                  />
                ))}
              </div>
              <FieldError message={error("supportTypes")} />
            </fieldset>
          )}

          {step === "meeting" && (
            <fieldset>
              <legend className="sr-only">{t("meeting.title")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {MEETING_MODES.map((value) => (
                  <ChoiceCard
                    key={value}
                    type="radio"
                    value={value}
                    registration={register("meetingMode")}
                    Icon={MEETING_ICONS[value]}
                    title={t(`meeting.options.${value}`)}
                  />
                ))}
              </div>
              <FieldError message={error("meetingMode")} />
            </fieldset>
          )}

          {step === "city" && (
            <TextField
              label={t("city.label")}
              placeholder={t("city.placeholder")}
              registration={register("city")}
              error={error("city")}
              autoComplete="address-level2"
            />
          )}

          {step === "language" && (
            <fieldset>
              <legend className="sr-only">{t("language.title")}</legend>
              <div className="grid grid-cols-2 gap-3">
                {LANGUAGES.map((value) => (
                  <ChoiceCard
                    key={value}
                    type="radio"
                    value={value}
                    registration={register("language")}
                    title={<span lang={value}>{LANGUAGE_NAMES[value]}</span>}
                  />
                ))}
              </div>
              <FieldError message={error("language")} />
            </fieldset>
          )}

          {step === "note" && (
            <div>
              <label htmlFor="note" className="block font-medium text-ink">
                {t("note.label")} <span className="font-normal text-ink-soft">({t("optional")})</span>
              </label>
              <p className="mt-1 text-sm text-secondary">{t("note.warning")}</p>
              <textarea
                id="note"
                rows={4}
                maxLength={500}
                {...register("note")}
                aria-invalid={!!errors.note}
                className="mt-3 w-full resize-y rounded-2xl bg-surface px-4 py-3 text-ink shadow-soft outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary"
              />
              <p className="mt-1 text-end text-sm text-ink-soft" aria-live="polite">
                {t("note.counter", { count: noteLength })}
              </p>
              <FieldError message={error("note")} />
            </div>
          )}

          {step === "details" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label={t("details.firstName")} registration={register("firstName")} error={error("firstName")} autoComplete="given-name" />
              <TextField label={t("details.lastName")} registration={register("lastName")} error={error("lastName")} autoComplete="family-name" />
              <div className="sm:col-span-2">
                <TextField
                  label={t("details.phone")}
                  hint={t("details.phoneHint")}
                  registration={register("phone")}
                  error={error("phone")}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  label={t("details.email")}
                  badge={t("recommended")}
                  hint={t("details.emailHint")}
                  registration={register("email")}
                  error={error("email")}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {step === "agree" && (
            <div>
              <p className="text-lg leading-relaxed text-ink-soft">{t("agree.body")}</p>
              <label className="mt-6 flex cursor-pointer items-start gap-4 rounded-3xl bg-surface p-5 shadow-soft">
                <input
                  type="checkbox"
                  {...register("scopeAgreed")}
                  className="peer sr-only"
                  aria-invalid={!!errors.scopeAgreed}
                />
                <span
                  aria-hidden
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ring-2 ring-line text-transparent peer-checked:bg-primary peer-checked:text-primary-ink peer-checked:ring-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]"
                >
                  <Check className="size-5" strokeWidth={3} />
                </span>
                <span className="text-ink">{t("agree.checkbox")}</span>
              </label>
              <FieldError message={error("scopeAgreed")} />
              <Link href={routes.terms} target="_blank" className="mt-4 inline-block text-sm text-primary underline underline-offset-4">
                {t("agree.terms")}
              </Link>
            </div>
          )}
        </div>

        {(status === "failed" || status === "unavailable") && (
          <p role="alert" className="mt-8 rounded-2xl bg-secondary-soft p-4 text-ink">
            {t(status === "failed" ? "errors.sendFailed" : "errors.unavailable")}
          </p>
        )}

        {/* Back / Continue */}
        <div className="mt-10 flex items-center justify-between gap-4">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={() => setStepIndex((i) => i - 1)}
              className="pill px-5 py-3 text-base text-ink-soft hover:bg-surface-soft hover:text-ink"
            >
              <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" />
              {t("back")}
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
                  {t("sending")}
                </>
              ) : (
                <>
                  {t("send")}
                  <Send aria-hidden className="size-5 rtl:-scale-x-100" />
                </>
              )
            ) : (
              <>
                {t("next")}
                <ArrowRight aria-hidden className="size-5 rtl:-scale-x-100" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Exit confirmation: the native <dialog> traps focus and closes on Escape. */}
      <dialog
        ref={exitRef}
        aria-labelledby="exit-title"
        className="m-auto w-[min(26rem,calc(100%-2.5rem))] rounded-3xl bg-surface p-7 text-ink shadow-lifted backdrop:bg-black/30"
      >
        <h2 id="exit-title" className="text-xl font-semibold">
          {t("exitDialog.title")}
        </h2>
        <p className="mt-3 text-ink-soft">{t("exitDialog.body")}</p>
        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => exitRef.current?.close()}
            className="pill bg-primary px-5 py-3 text-base text-primary-ink hover:bg-primary-hover"
          >
            {t("exitDialog.stay")}
          </button>
          <button
            type="button"
            onClick={() => router.push(routes.home)}
            className="pill bg-surface-soft px-5 py-3 text-base text-ink hover:shadow-soft"
          >
            {t("exitDialog.leave")}
          </button>
        </div>
      </dialog>
    </section>
  );
}

function stepHint(step: StepId, t: ReturnType<typeof useTranslations<"intake">>) {
  switch (step) {
    case "support":
      return t("support.hint");
    case "city":
      return t("city.hint");
    case "note":
      return t("note.hint");
    case "details":
      return t("details.hint");
    default:
      return undefined;
  }
}

function StepHeading({
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

/** Large tappable option. A visually hidden native input keeps keyboard and screen reader support. */
function ChoiceCard({
  type,
  value,
  registration,
  Icon,
  title,
  body,
}: {
  type: "checkbox" | "radio";
  value: string;
  registration: UseFormRegisterReturn;
  Icon?: LucideIcon;
  title: ReactNode;
  body?: string;
}) {
  return (
    <label className="relative block cursor-pointer">
      <input type={type} value={value} {...registration} className="peer sr-only" />
      <span className="flex h-full items-start gap-4 rounded-3xl bg-surface p-5 shadow-soft ring-2 ring-transparent transition-shadow hover:shadow-lifted peer-checked:bg-primary-soft peer-checked:ring-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]">
        {Icon && (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary-soft">
            <Icon aria-hidden className="size-6 text-secondary" strokeWidth={1.75} />
          </span>
        )}
        <span className="flex-1 self-center">
          <span className="block text-lg font-medium text-ink">{title}</span>
          {body && <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{body}</span>}
        </span>
      </span>
      {/* Check badge, shown when selected */}
      <span
        aria-hidden
        className="absolute end-3 top-3 hidden size-6 items-center justify-center rounded-full bg-primary text-primary-ink peer-checked:flex"
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
    </label>
  );
}

function TextField({
  label,
  hint,
  badge,
  error,
  registration,
  ...input
}: {
  label: string;
  hint?: string;
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

/** Gentle inline error: blue-toned, never red (PRD §3). */
function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-sm font-medium text-secondary">
      {message}
    </p>
  );
}
