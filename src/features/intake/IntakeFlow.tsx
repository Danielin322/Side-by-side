"use client";

import { useRef, useState, useTransition } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { CircleCheck } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import {
  AgreeCheckbox,
  ChoiceCard,
  ExitDialog,
  FieldError,
  Notice,
  StepHeading,
  StepNav,
  StepProgress,
  TextAreaField,
  TextField,
  errorMessageAt,
  useStepFocus,
} from "@/components/form/FormParts";
import {
  LANGUAGES,
  LANGUAGE_NAMES,
  MEETING_MODES,
  SUPPORT_TYPES,
  intakeSchema,
  type IntakeValues,
} from "./schema";
import { submitHelpRequest } from "./actions";

import { MEETING_ICONS, SUPPORT_ICONS } from "./icons";

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

const STEP_HINTS: Partial<Record<StepId, "support.hint" | "city.hint" | "note.hint" | "details.hint">> = {
  support: "support.hint",
  city: "city.hint",
  note: "note.hint",
  details: "details.hint",
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
  const exitRef = useRef<HTMLDialogElement>(null);
  const headingRef = useStepFocus(`${stepIndex}-${status === "done"}`);

  const {
    register,
    trigger,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(intakeSchema),
    mode: "onTouched",
    defaultValues: { supportTypes: [], city: "", note: "", firstName: "", lastName: "", phone: "", email: "" },
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
    const key = errorMessageAt(errors, field);
    return key ? t(`errors.${key}` as Parameters<typeof t>[0]) : undefined;
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

  const hintKey = STEP_HINTS[step];

  return (
    <section className="container-page max-w-2xl py-8 sm:py-12">
      <StepProgress
        label={t("progress", { current: stepIndex + 1, total: steps.length })}
        current={stepIndex + 1}
        total={steps.length}
        exitLabel={t("exit")}
        onExit={() => exitRef.current?.showModal()}
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (isLast) send();
          else next();
        }}
        className="mt-10"
      >
        <StepHeading headingRef={headingRef} title={t(`${step}.title`)} hint={hintKey ? t(hintKey) : undefined} />

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
            <TextAreaField
              label={
                <>
                  {t("note.label")} <span className="font-normal text-ink-soft">({t("optional")})</span>
                </>
              }
              hint={t("note.warning")}
              registration={register("note")}
              error={error("note")}
              maxLength={500}
              count={noteLength}
              counterLabel={t("note.counter", { count: "{count}" })}
            />
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
              <div className="mt-6">
                <AgreeCheckbox registration={register("scopeAgreed")} label={t("agree.checkbox")} invalid={!!errors.scopeAgreed} />
              </div>
              <FieldError message={error("scopeAgreed")} />
              <Link href={routes.terms} target="_blank" className="mt-4 inline-block text-sm text-primary underline underline-offset-4">
                {t("agree.terms")}
              </Link>
            </div>
          )}
        </div>

        {(status === "failed" || status === "unavailable") && (
          <div className="mt-8">
            <Notice role="alert">{t(status === "failed" ? "errors.sendFailed" : "errors.unavailable")}</Notice>
          </div>
        )}

        <StepNav
          showBack={stepIndex > 0}
          onBack={() => setStepIndex((i) => i - 1)}
          isLast={isLast}
          sending={sending}
          labels={{ back: t("back"), next: t("next"), send: t("send"), sending: t("sending") }}
        />
      </form>

      <ExitDialog
        ref={exitRef}
        title={t("exitDialog.title")}
        body={t("exitDialog.body")}
        stay={t("exitDialog.stay")}
        leave={t("exitDialog.leave")}
        onLeave={() => router.push(routes.home)}
      />
    </section>
  );
}
