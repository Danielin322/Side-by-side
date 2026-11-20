"use client";

import { useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  Car,
  Check,
  CircleCheck,
  Flag,
  Hourglass,
  Languages,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
  Video,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/form/FormParts";
import { LANGUAGE_NAMES } from "@/features/intake/schema";
import { MEETING_ICONS, SUPPORT_ICONS } from "@/features/intake/icons";
import {
  ISSUE_KINDS,
  MAX_CHECKLIST_ITEMS,
  MAX_CHECKLIST_TEXT,
  RELEASE_REASONS,
  type ChecklistItem,
  type FitBadges,
  type FitTag,
  type IssueKind,
  type MyRequest,
  type OpenRequest,
  type ReleaseReason,
  type RequestActionResult,
} from "./model";
import { acceptRequest, completeRequest, releaseRequest, reportIssue, saveChecklist, saveNextMeeting } from "./actions";

// ----------------------------------------------------------------------------- shared bits

function useErrorText() {
  const t = useTranslations("requests");
  return (r: RequestActionResult | null) => (r && !r.ok ? t(`errors.${r.error}`) : null);
}

function Chip({ icon, children, tone = "plain" }: { icon?: ReactNode; children: ReactNode; tone?: "plain" | "good" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
        tone === "good" ? "bg-primary-soft text-ink" : "bg-surface-soft text-ink-soft"
      }`}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * What the person asked for, laid out to read at a glance: a list of the kinds of help they need,
 * and beside it the practical details (language, how to meet).
 */
function RequestNeeds({ req }: { req: OpenRequest }) {
  const t = useTranslations("requests.needs");
  const tIntake = useTranslations("intake");
  const MeetingIcon = MEETING_ICONS[req.meeting_mode];
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <div>
        <h4 className="text-sm font-medium text-ink-soft">{t("title")}</h4>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {req.support_types.map((s) => {
            const Icon = SUPPORT_ICONS[s];
            return (
              <li key={s} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
                  <Icon aria-hidden className="size-5 text-primary" strokeWidth={1.75} />
                </span>
                <span className="text-ink">{tIntake(`support.options.${s}.title`)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <dl className="space-y-3 self-start rounded-2xl bg-surface-soft p-4 sm:min-w-52">
        <div className="flex items-start gap-3">
          <Languages aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-soft" />
          <div>
            <dt className="text-sm text-ink-soft">{t("language")}</dt>
            <dd className="font-medium text-ink" lang={req.language}>
              {LANGUAGE_NAMES[req.language]}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MeetingIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-soft" />
          <div>
            <dt className="text-sm text-ink-soft">{t("meeting")}</dt>
            <dd className="font-medium text-ink">
              {tIntake(`meeting.options.${req.meeting_mode}`)}
              {req.city && <span className="block text-sm font-normal text-ink-soft">{req.city}</span>}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  );
}

function PrimaryButton({ pending, children, ...rest }: { pending?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={pending || rest.disabled}
      className="pill bg-primary px-5 py-3 text-base text-primary-ink shadow-soft hover:bg-primary-hover disabled:opacity-60"
    >
      {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

function SoftButton({ icon, children, ...rest }: { icon: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} type="button" className="pill bg-surface-soft px-4 py-2.5 text-ink hover:shadow-soft">
      {icon}
      {children}
    </button>
  );
}

function RadioList<T extends string>({
  name,
  options,
  value,
  onChange,
  label,
}: {
  name: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  label: (v: T) => string;
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <label key={o} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-soft px-4 py-3">
          <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} className="size-4 accent-[var(--primary)]" />
          <span>{label(o)}</span>
        </label>
      ))}
    </div>
  );
}

function NoteBox({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="mt-4 block">
      <span className="font-medium text-ink">{label}</span>
      {hint && <span className="mt-1 block text-sm text-secondary">{hint}</span>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={1000}
        className="mt-2 w-full resize-y rounded-2xl bg-surface-soft px-4 py-3 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary"
      />
    </label>
  );
}

// ----------------------------------------------------------------------------- open request

const FIT_TAG_ICONS: Record<FitTag, typeof Check> = {
  language: Languages,
  same_city: MapPin,
  nearby: MapPin,
  meeting_mode: Video,
  support: Check,
  transport: Car,
  long_wait: Hourglass,
};

export function OpenRequestCard({
  req,
  badges,
  waiting,
  atLimit,
  fitTags,
}: {
  req: OpenRequest;
  badges: FitBadges;
  waiting: string;
  atLimit: boolean;
  /** "Why it fits" chips for Best matches; replaces the rule badges when given. */
  fitTags?: FitTag[];
}) {
  const t = useTranslations("requests");
  const errorText = useErrorText();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<RequestActionResult | null>(null);

  return (
    <li className="rounded-3xl bg-surface p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-ink">{req.first_name}</h3>
          <p className="text-sm text-ink-soft">{waiting}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {fitTags ? (
            fitTags.map((tag) => {
              const Icon = FIT_TAG_ICONS[tag];
              return (
                <Chip key={tag} tone="good" icon={<Icon aria-hidden className="size-4 text-primary" />}>
                  {t(`bestMatch.tags.${tag}`)}
                </Chip>
              );
            })
          ) : (
            <>
              {badges.language && <Chip tone="good" icon={<Sparkles aria-hidden className="size-4 text-primary" />}>{t("badges.language")}</Chip>}
              {badges.city && <Chip tone="good" icon={<MapPin aria-hidden className="size-4 text-primary" />}>{t("badges.city")}</Chip>}
              {badges.nearby && <Chip tone="good" icon={<MapPin aria-hidden className="size-4 text-primary" />}>{t("bestMatch.tags.nearby")}</Chip>}
              {badges.support > 0 && <Chip tone="good" icon={<Check aria-hidden className="size-4 text-primary" />}>{t("badges.support", { count: badges.support })}</Chip>}
            </>
          )}
        </div>
      </div>
      <div className="mt-4">
        <RequestNeeds req={req} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton
          type="button"
          pending={pending}
          disabled={atLimit}
          onClick={() => start(async () => setResult(await acceptRequest(req.id)))}
        >
          {t("open.accept")}
        </PrimaryButton>
        {atLimit && <span className="text-sm text-ink-soft">{t("open.atLimit")}</span>}
      </div>
      {errorText(result) && (
        <div className="mt-4">
          <Notice role="alert">{errorText(result)}</Notice>
        </div>
      )}
    </li>
  );
}

// ----------------------------------------------------------------------------- volunteer checklist

/**
 * The volunteer's own list of steps for a request: they add steps, tick them off and delete them.
 * Nothing is built in; the list starts empty when a volunteer takes on a request.
 */
function VolunteerChecklist({ items, onChange }: { items: ChecklistItem[]; onChange: (next: ChecklistItem[]) => void }) {
  const t = useTranslations("requests");
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const full = items.length >= MAX_CHECKLIST_ITEMS;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || full) return;
    onChange([...items, { id: crypto.randomUUID(), text, done: false }]);
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <section aria-labelledby={titleId} className="mt-6">
      <h4 id={titleId} className="font-medium text-ink">
        {t("checklist.title")}
      </h4>
      <p className="mt-1 text-sm text-ink-soft">
        {t("checklist.hint")} {t("noMedical")}
      </p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-surface-soft px-4 py-3 text-ink-soft">{t("checklist.empty")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 rounded-2xl bg-surface-soft py-1.5 pe-1.5 ps-4">
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-1.5">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => onChange(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg text-transparent ring-2 ring-line peer-checked:bg-primary peer-checked:text-primary-ink peer-checked:ring-primary peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]"
                >
                  <Check className="size-4" strokeWidth={3} />
                </span>
                <span className={`min-w-0 break-words ${item.done ? "text-ink-soft line-through decoration-line" : "text-ink"}`}>
                  {item.text}
                </span>
              </label>
              <button
                type="button"
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                aria-label={t("checklist.delete", { step: item.text })}
                title={t("checklist.deleteShort")}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-surface hover:text-ink"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-3 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_CHECKLIST_TEXT}
          disabled={full}
          aria-label={t("checklist.newLabel")}
          placeholder={t("checklist.placeholder")}
          className="min-w-0 flex-1 rounded-2xl bg-surface-soft px-4 py-3 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!draft.trim() || full}
          className="pill bg-surface-soft px-4 py-3 text-ink hover:shadow-soft disabled:opacity-50"
        >
          <Plus aria-hidden className="size-4" />
          {t("checklist.add")}
        </button>
      </form>
      {full && <p className="mt-2 text-sm text-ink-soft">{t("checklist.full", { max: MAX_CHECKLIST_ITEMS })}</p>}
    </section>
  );
}

// ----------------------------------------------------------------------------- my request

type Dialog = "issue" | "release" | "complete" | null;

export function MyRequestCard({ req }: { req: MyRequest }) {
  const t = useTranslations("requests");
  const errorText = useErrorText();
  const [items, setItems] = useState<ChecklistItem[]>(req.checklist_items ?? []);
  const [nextMeeting, setNextMeeting] = useState(req.next_meeting ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [result, setResult] = useState<RequestActionResult | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [issueKind, setIssueKind] = useState<IssueKind | null>(null);
  const [reason, setReason] = useState<ReleaseReason | null>(null);
  const [note, setNote] = useState("");
  const [concern, setConcern] = useState("");
  const [pending, start] = useTransition();
  const [reported, setReported] = useState(false);

  const save = (fn: () => Promise<RequestActionResult>) => {
    setSaveState("saving");
    start(async () => {
      const r = await fn();
      setResult(r.ok ? null : r);
      setSaveState(r.ok ? "saved" : "idle");
    });
  };

  /** Every change (add, tick, delete) saves the whole list. */
  const updateItems = (next: ChecklistItem[]) => {
    setItems(next);
    save(() => saveChecklist(req.id, next));
  };

  const openDialog = (d: Dialog) => {
    setNote("");
    setConcern("");
    setIssueKind(null);
    setReason(null);
    setResult(null);
    setDialog(d);
  };

  const run = (fn: () => Promise<RequestActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r.ok ? null : r);
      if (r.ok) {
        setDialog(null);
        after?.();
      }
    });

  const total = items.length;
  const done = items.filter((i) => i.done).length;

  return (
    <li className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-semibold text-ink">
            {req.first_name} {req.last_name}
          </h3>
          {total > 0 && <p className="text-sm text-ink-soft">{t("mine.progress", { done, total })}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${req.phone}`} className="pill bg-primary px-4 py-2.5 text-primary-ink shadow-soft hover:bg-primary-hover">
            <Phone aria-hidden className="size-4" />
            <span dir="ltr">{req.phone}</span>
          </a>
          {req.email && (
            <a href={`mailto:${req.email}`} className="pill bg-surface-soft px-4 py-2.5 text-ink hover:shadow-soft">
              <Mail aria-hidden className="size-4" />
              <span dir="ltr">{req.email}</span>
            </a>
          )}
        </div>
      </div>

      <div className="mt-4">
        <RequestNeeds req={req} />
      </div>

      {req.note && (
        <div className="mt-5 rounded-2xl bg-warm-soft p-4">
          <p className="text-sm font-medium text-ink-soft">{t("mine.note")}</p>
          <p className="mt-1 whitespace-pre-line text-ink">{req.note}</p>
        </div>
      )}

      <VolunteerChecklist items={items} onChange={updateItems} />

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="flex items-center gap-2 font-medium text-ink">
            <CalendarDays aria-hidden className="size-4 text-secondary" />
            {t("mine.nextMeeting")}
          </span>
          <input
            type="date"
            value={nextMeeting}
            dir="ltr"
            onChange={(e) => {
              setNextMeeting(e.target.value);
              save(() => saveNextMeeting(req.id, e.target.value || null));
            }}
            className="mt-2 rounded-2xl bg-surface-soft px-4 py-3 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary [direction:ltr] rtl:text-right"
          />
        </label>
        <span role="status" className="pb-3 text-sm text-ink-soft">
          {saveState === "saving" ? t("mine.saving") : saveState === "saved" ? t("mine.saved") : ""}
        </span>
      </div>

      {reported && (
        <div className="mt-5">
          <Notice role="status">{t("issue.sent")}</Notice>
        </div>
      )}
      {!dialog && errorText(result) && (
        <div className="mt-5">
          <Notice role="alert">{errorText(result)}</Notice>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-line/60 pt-5">
        <PrimaryButton type="button" onClick={() => openDialog("complete")}>
          <CircleCheck aria-hidden className="size-4" />
          {t("mine.complete")}
        </PrimaryButton>
        <SoftButton icon={<Flag aria-hidden className="size-4 text-secondary" />} onClick={() => openDialog("issue")}>
          {t("mine.report")}
        </SoftButton>
        <SoftButton icon={<Undo2 aria-hidden className="size-4 rtl:-scale-x-100" />} onClick={() => openDialog("release")}>
          {t("mine.release")}
        </SoftButton>
      </div>

      {/* Report an issue */}
      <Modal open={dialog === "issue"} onClose={() => setDialog(null)} title={t("issue.title")} closeLabel={t("close")}>
        <p className="mb-4 text-ink-soft">{t("issue.intro")}</p>
        <RadioList name={`issue-${req.id}`} options={ISSUE_KINDS} value={issueKind} onChange={setIssueKind} label={(k) => t(`issue.kinds.${k}`)} />
        <NoteBox label={t("optionalNote")} hint={t("noMedical")} value={note} onChange={setNote} />
        {errorText(result) && <div className="mt-4"><Notice role="alert">{errorText(result)}</Notice></div>}
        <div className="mt-6 flex justify-end">
          <PrimaryButton
            type="button"
            pending={pending}
            disabled={!issueKind}
            onClick={() => issueKind && run(() => reportIssue(req.id, issueKind, note), () => setReported(true))}
          >
            {t("issue.submit")}
          </PrimaryButton>
        </div>
      </Modal>

      {/* Hand back */}
      <Modal open={dialog === "release"} onClose={() => setDialog(null)} title={t("release.title")} closeLabel={t("close")}>
        <p className="mb-4 text-ink-soft">{t("release.intro")}</p>
        <RadioList name={`release-${req.id}`} options={RELEASE_REASONS} value={reason} onChange={setReason} label={(r) => t(`release.reasons.${r}`)} />
        <NoteBox label={t("optionalNote")} value={note} onChange={setNote} />
        {errorText(result) && <div className="mt-4"><Notice role="alert">{errorText(result)}</Notice></div>}
        <div className="mt-6 flex justify-end">
          <PrimaryButton type="button" pending={pending} disabled={!reason} onClick={() => reason && run(() => releaseRequest(req.id, reason, note))}>
            {t("release.submit")}
          </PrimaryButton>
        </div>
      </Modal>

      {/* Close */}
      <Modal open={dialog === "complete"} onClose={() => setDialog(null)} title={t("complete.title")} closeLabel={t("close")}>
        <p className="text-ink-soft">{t("complete.intro")}</p>
        <NoteBox label={t("complete.summary")} hint={t("noMedical")} value={note} onChange={setNote} />
        <NoteBox label={t("complete.concern")} hint={t("complete.concernHint")} value={concern} onChange={setConcern} />
        {errorText(result) && <div className="mt-4"><Notice role="alert">{errorText(result)}</Notice></div>}
        <div className="mt-6 flex justify-end">
          <PrimaryButton type="button" pending={pending} onClick={() => run(() => completeRequest(req.id, note, concern))}>
            {t("complete.submit")}
          </PrimaryButton>
        </div>
      </Modal>
    </li>
  );
}
