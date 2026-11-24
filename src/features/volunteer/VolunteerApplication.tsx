"use client";

import { useRef, useState, useTransition } from "react";
import { useForm, type FieldPath, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Bus, Car, CircleCheck, IdCard, ShieldCheck } from "lucide-react";
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
import { SUPPORT_TYPES } from "@/features/intake/schema";
import { MEETING_ICONS, SUPPORT_ICONS } from "@/features/intake/icons";
import { adminVolunteerSchema, DEFAULT_LANGUAGES, TRANSPORT, VOLUNTEER_MEETING_MODES, volunteerSchema, type VolunteerValues } from "./schema";
import { completeMyVolunteerProfile, submitVolunteerApplication, type ApplyResult } from "./actions";
import { AvailabilityGrid, LanguageLevels } from "./fields";

type StepId = "personal" | "availability" | "languages" | "offer" | "background" | "declarations" | "account";

const STEPS: StepId[] = ["personal", "availability", "languages", "offer", "background", "declarations", "account"];
// Someone already signed in (for example an admin) applies for their own account: no account step.
const SIGNED_IN_STEPS: StepId[] = STEPS.filter((s) => s !== "account");

const STEP_FIELDS: Record<StepId, FieldPath<VolunteerValues>[]> = {
  personal: ["fullName", "nationalId", "birthDate", "city", "phone", "occupation"],
  availability: ["availability", "commitSixMonths", "transport"],
  languages: ["languages"],
  offer: ["supportTypes", "meetingModes"],
  background: ["experience", "motivation", "skills"],
  declarations: ["backgroundConsent", "conductAgreed"],
  account: ["email", "password", "passwordConfirm"],
};

const TRANSPORT_ICONS = { license: IdCard, car: Car, public_transit: Bus } as const;

type FailReason = Extract<ApplyResult, { ok: false }>["reason"];

/**
 * Multi-step volunteer application. Ends by creating the account and sending the application.
 * `mode="signedIn"`: an account without a volunteer profile applies for itself, with no account step.
 * `admin`: that account is an admin, so the profile is approved at once (every admin is also a volunteer).
 */
export function VolunteerApplication({ mode = "signup", admin = false }: { mode?: "signup" | "signedIn"; admin?: boolean }) {
  const signedIn = mode === "signedIn";
  const isAdmin = signedIn && admin;
  const steps = signedIn ? SIGNED_IN_STEPS : STEPS;
  const t = useTranslations("volunteer");
  const tIntake = useTranslations("intake");
  const locale = useLocale();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [sending, startSending] = useTransition();
  const exitRef = useRef<HTMLDialogElement>(null);
  const done = result?.ok === true;
  const headingRef = useStepFocus(`${stepIndex}-${done}`);

  const {
    register,
    trigger,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm({
    // The admin schema has no account fields; the form keeps one value type for both modes.
    resolver: (signedIn ? zodResolver(adminVolunteerSchema) : zodResolver(volunteerSchema)) as Resolver<VolunteerValues>,
    mode: "onTouched",
    defaultValues: {
      fullName: "",
      nationalId: "",
      birthDate: "",
      city: "",
      phone: "",
      occupation: "",
      availability: [],
      transport: [],
      languages: DEFAULT_LANGUAGES,
      supportTypes: [],
      meetingModes: [],
      experience: "",
      motivation: "",
      skills: "",
      email: "",
      password: "",
      passwordConfirm: "",
    },
  });

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  async function next() {
    if (await trigger(STEP_FIELDS[step], { shouldFocus: true })) setStepIndex((i) => i + 1);
  }

  const send = handleSubmit((values) => {
    startSending(async () => {
      const res = signedIn ? await completeMyVolunteerProfile(values, locale) : await submitVolunteerApplication(values, locale);
      setResult(res);
      if (signedIn && res.ok) router.refresh();
    });
  });

  const error = (field: FieldPath<VolunteerValues>) => {
    const key = errorMessageAt(errors, field);
    return key ? t(`errors.${key}` as Parameters<typeof t>[0]) : undefined;
  };

  if (done) {
    return (
      <section className="container-page max-w-2xl py-16 text-center sm:py-24">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary-soft">
          <CircleCheck aria-hidden className="size-10 text-primary" strokeWidth={1.75} />
        </span>
        <h1 ref={headingRef} tabIndex={-1} className="mt-8 text-3xl font-semibold text-ink outline-none sm:text-4xl">
          {t(isAdmin ? "adminProfile.doneTitle" : "done.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-ink-soft">{t(isAdmin ? "adminProfile.doneBody" : "done.body")}</p>
        {result.needsConfirmation && (
          <p className="mx-auto mt-4 max-w-lg rounded-2xl bg-secondary-soft p-4 text-ink">
            {t("done.confirmEmail", { email: watch("email") })}
          </p>
        )}
        <Link href={signedIn ? routes.volunteerDashboard : routes.home} className="btn-secondary mt-10">
          {t(signedIn ? "adminProfile.toDashboard" : "done.home")}
        </Link>
      </section>
    );
  }

  const failReason: FailReason | null = result && !result.ok ? result.reason : null;

  return (
    <section className="container-page max-w-2xl py-8 sm:py-12">
      {signedIn && (
        <div className="mb-6">
          <Notice>{t(isAdmin ? "adminProfile.intro" : "adminProfile.signedInIntro")}</Notice>
        </div>
      )}
      <StepProgress
        label={tIntake("progress", { current: stepIndex + 1, total: steps.length })}
        current={stepIndex + 1}
        total={steps.length}
        exitLabel={tIntake("exit")}
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
        <StepHeading headingRef={headingRef} title={t(`${step}.title`)} hint={t(`${step}.hint`)} />

        <div className="mt-8">
          {step === "personal" && (
            <div className="space-y-5">
              <div className="flex gap-3 rounded-2xl bg-secondary-soft p-4 text-sm text-ink">
                <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-secondary" />
                <p>{t("personal.privacy")}</p>
              </div>
              <TextField label={t("personal.fullName")} registration={register("fullName")} error={error("fullName")} autoComplete="name" />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label={t("personal.nationalId")}
                  registration={register("nationalId")}
                  error={error("nationalId")}
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                />
                <TextField
                  label={t("personal.birthDate")}
                  registration={register("birthDate")}
                  error={error("birthDate")}
                  type="date"
                  autoComplete="bday"
                  dir="ltr"
                  className="[direction:ltr] rtl:text-right"
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label={t("personal.city")} registration={register("city")} error={error("city")} autoComplete="address-level2" />
                <TextField
                  label={t("personal.phone")}
                  registration={register("phone")}
                  error={error("phone")}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                />
              </div>
              <TextField
                label={t("personal.occupation")}
                badge={tIntake("optional")}
                hint={t("personal.occupationHint")}
                registration={register("occupation")}
                error={error("occupation")}
              />
            </div>
          )}

          {step === "availability" && (
            <div className="space-y-10">
              <AvailabilityGrid
                legend={t("availability.weekly")}
                registration={register("availability")}
                error={error("availability")}
              />

              <fieldset>
                <legend className="font-medium text-ink">{t("availability.commit")}</legend>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {(["yes", "no"] as const).map((v) => (
                    <ChoiceCard key={v} type="radio" value={v} registration={register("commitSixMonths")} title={t(`availability.commitOptions.${v}`)} compact />
                  ))}
                </div>
                <FieldError message={error("commitSixMonths")} />
              </fieldset>

              <fieldset>
                <legend className="font-medium text-ink">
                  {t("availability.transport")} <span className="font-normal text-ink-soft">({tIntake("optional")})</span>
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {TRANSPORT.map((v) => (
                    <ChoiceCard
                      key={v}
                      type="checkbox"
                      value={v}
                      registration={register("transport")}
                      Icon={TRANSPORT_ICONS[v]}
                      title={t(`availability.transportOptions.${v}`)}
                      compact
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === "languages" && (
            <LanguageLevels
              legend={t("languages.title")}
              legendHidden
              register={(lang) => register(`languages.${lang}`)}
              error={error("languages")}
            />
          )}

          {step === "offer" && (
            <div className="space-y-10">
              <fieldset>
                <legend className="font-medium text-ink">{t("offer.support")}</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {SUPPORT_TYPES.map((value) => (
                    <ChoiceCard
                      key={value}
                      type="checkbox"
                      value={value}
                      registration={register("supportTypes")}
                      Icon={SUPPORT_ICONS[value]}
                      title={tIntake(`support.options.${value}.title`)}
                      compact
                    />
                  ))}
                </div>
                <FieldError message={error("supportTypes")} />
              </fieldset>
              <fieldset>
                <legend className="font-medium text-ink">{t("offer.meeting")}</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {VOLUNTEER_MEETING_MODES.map((value) => (
                    <ChoiceCard
                      key={value}
                      type="checkbox"
                      value={value}
                      registration={register("meetingModes")}
                      Icon={MEETING_ICONS[value]}
                      title={tIntake(`meeting.options.${value}`)}
                      compact
                    />
                  ))}
                </div>
                <FieldError message={error("meetingModes")} />
              </fieldset>
            </div>
          )}

          {step === "background" && (
            <div className="space-y-8">
              <TextAreaField
                label={t("background.motivation")}
                hint={t("background.motivationHint")}
                registration={register("motivation")}
                error={error("motivation")}
                maxLength={1000}
                count={watch("motivation")?.length ?? 0}
                counterLabel="{count}/1000"
              />
              <TextAreaField
                label={
                  <>
                    {t("background.experience")} <span className="font-normal text-ink-soft">({tIntake("optional")})</span>
                  </>
                }
                hint={t("background.experienceHint")}
                registration={register("experience")}
                error={error("experience")}
                maxLength={1000}
                count={watch("experience")?.length ?? 0}
                counterLabel="{count}/1000"
                rows={3}
              />
              <TextField
                label={t("background.skills")}
                badge={tIntake("optional")}
                hint={t("background.skillsHint")}
                registration={register("skills")}
                error={error("skills")}
              />
            </div>
          )}

          {step === "declarations" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-surface p-6 shadow-soft">
                <h2 className="text-lg font-semibold text-ink">{t("declarations.conductTitle")}</h2>
                <ul className="mt-3 list-disc space-y-2 ps-5 text-ink-soft">
                  {(["one", "two", "three", "four"] as const).map((k) => (
                    <li key={k}>{t(`declarations.conduct.${k}`)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <AgreeCheckbox registration={register("conductAgreed")} label={t("declarations.conductAgree")} invalid={!!errors.conductAgreed} />
                <FieldError message={error("conductAgreed")} />
              </div>
              <div>
                <AgreeCheckbox registration={register("backgroundConsent")} label={t("declarations.background")} invalid={!!errors.backgroundConsent} />
                <FieldError message={error("backgroundConsent")} />
              </div>
            </div>
          )}

          {step === "account" && (
            <div className="space-y-5">
              <TextField
                label={t("account.email")}
                registration={register("email")}
                error={error("email")}
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
              />
              <TextField
                label={t("account.password")}
                hint={t("account.passwordHint")}
                registration={register("password")}
                error={error("password")}
                type="password"
                autoComplete="new-password"
                dir="ltr"
              />
              <TextField
                label={t("account.passwordConfirm")}
                registration={register("passwordConfirm")}
                error={error("passwordConfirm")}
                type="password"
                autoComplete="new-password"
                dir="ltr"
              />
              <p className="text-sm text-ink-soft">
                {t("account.haveAccount")}{" "}
                <Link href={routes.volunteerLogin} className="font-medium text-primary underline underline-offset-4">
                  {t("account.signIn")}
                </Link>
              </p>
            </div>
          )}
        </div>

        {failReason && (
          <div className="mt-8">
            <Notice role="alert">{t(`sendErrors.${failReason}`)}</Notice>
          </div>
        )}

        <StepNav
          showBack={stepIndex > 0}
          onBack={() => setStepIndex((i) => i - 1)}
          isLast={isLast}
          sending={sending}
          labels={{ back: tIntake("back"), next: tIntake("next"), send: t("send"), sending: tIntake("sending") }}
        />
      </form>

      {stepIndex === 0 && !signedIn && (
        <p className="mt-8 text-center text-sm text-ink-soft">
          {t("account.haveAccount")}{" "}
          <Link href={routes.volunteerLogin} className="font-medium text-primary underline underline-offset-4">
            {t("account.signIn")}
          </Link>
        </p>
      )}

      <ExitDialog
        ref={exitRef}
        title={tIntake("exitDialog.title")}
        body={tIntake("exitDialog.body")}
        stay={tIntake("exitDialog.stay")}
        leave={tIntake("exitDialog.leave")}
        onLeave={() => router.push(isAdmin ? routes.admin : routes.home)}
      />
    </section>
  );
}
