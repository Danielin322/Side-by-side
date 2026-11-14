"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, CalendarClock, CalendarPlus, LoaderCircle, Pencil, Video } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/form/FormParts";
import { TimeSelect } from "@/components/form/TimeSelect";
import { isoToIsraelLocal, israelToday } from "@/lib/time";
import type { VolunteerStatus } from "@/features/volunteer/schema";
import { closeMeeting, scheduleMeeting, setVolunteerStatus, type AdminState } from "./actions";

export type MeetingInfo = { scheduled_at: string; link: string | null; note: string | null };

/**
 * Verification controls for one volunteer.
 * Waiting: schedule / edit the meeting (date, time, link, note), and Verify (asks to confirm).
 * The details page also offers "Not approved", "Move back to unverified" and "Reconsider".
 */
export function VolunteerStatusActions({
  id,
  name,
  status,
  variant,
  meeting,
  badge,
  passed = false,
  lastMissed = false,
}: {
  id: string;
  name: string;
  status: VolunteerStatus;
  variant: "list" | "detail";
  meeting: MeetingInfo | null;
  /** Server-computed label such as "Today 18:30" (time-dependent, so not computed here). */
  badge?: string | null;
  passed?: boolean;
  lastMissed?: boolean;
}) {
  const t = useTranslations("admin.volunteers");
  const tm = useTranslations("admin.meetings");
  const tAdmin = useTranslations("admin");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminState>(null);
  const [confirming, setConfirming] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const change = (next: VolunteerStatus) =>
    start(async () => {
      setResult(await setVolunteerStatus(id, next));
      setConfirming(false);
    });

  const error = result?.error ? (
    <span role="alert" className="text-sm text-secondary">
      {tAdmin(`errors.${result.error}`)}
    </span>
  ) : null;

  if (status === "applied" || status === "interview") {
    return (
      <div className="space-y-3">
        {/* Meeting */}
        <div className="flex flex-wrap items-center gap-2">
          {meeting ? (
            <>
              {/* The meeting time itself opens the dialog to change it. */}
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                title={tm("edit")}
                className={`group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-ink transition-shadow hover:shadow-soft ${
                  passed ? "bg-warm-soft" : "bg-secondary-soft"
                }`}
              >
                <CalendarClock aria-hidden className="size-4 text-secondary" />
                {badge}
                <Pencil aria-hidden className="size-3.5 text-ink-soft group-hover:text-ink" />
                <span className="sr-only">({tm("edit")})</span>
              </button>
              {meeting.link && (
                <a
                  href={meeting.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pill bg-surface-soft px-3 py-1.5 text-ink hover:shadow-soft"
                >
                  <Video aria-hidden className="size-4" />
                  {tm("join")}
                </a>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="pill bg-secondary-soft px-4 py-2 text-ink hover:shadow-soft"
              >
                <CalendarPlus aria-hidden className="size-4 text-secondary" />
                {tm("schedule")}
              </button>
              {lastMissed && <span className="text-sm text-ink-soft">{tm("lastMissed")}</span>}
            </>
          )}
        </div>
        {meeting?.note && variant === "detail" && <p className="text-sm text-ink-soft">{meeting.note}</p>}

        {/* Decision */}
        <div className="flex flex-wrap items-center gap-3">
          {confirming ? (
            <span className="inline-flex flex-wrap items-center gap-2 rounded-2xl bg-primary-soft px-3 py-2 text-sm text-ink">
              {t("verifyConfirm", { name })}
              <button
                type="button"
                disabled={pending}
                onClick={() => change("approved")}
                className="pill bg-primary px-3 py-1.5 text-primary-ink hover:bg-primary-hover disabled:opacity-60"
              >
                {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                {t("verifyYes")}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="pill px-3 py-1.5 text-ink-soft hover:text-ink">
                {t("cancel")}
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className="pill bg-primary px-4 py-2 text-primary-ink shadow-soft hover:bg-primary-hover disabled:opacity-60"
            >
              <BadgeCheck aria-hidden className="size-4" />
              {t("verify")}
            </button>
          )}
          {variant === "detail" && !confirming && (
            <button type="button" disabled={pending} onClick={() => change("not_approved")} className="pill text-sm text-ink-soft hover:text-ink">
              {t("notApprove")}
            </button>
          )}
          {error}
        </div>

        <MeetingDialog
          key={meeting ? `${meeting.scheduled_at}|${meeting.link}|${meeting.note}` : "new"}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          volunteerId={id}
          name={name}
          meeting={meeting}
        />
      </div>
    );
  }

  if (variant === "list") return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "approved" ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-ink">
            <BadgeCheck aria-hidden className="size-4 text-primary" />
            {t("verifiedBadge")}
          </span>
          <button type="button" disabled={pending} onClick={() => change("applied")} className="pill text-sm text-ink-soft hover:text-ink">
            {t("unverify")}
          </button>
        </>
      ) : (
        <>
          <span className="rounded-full bg-surface-soft px-3 py-1.5 text-sm text-ink-soft">{t("rejectedBadge")}</span>
          <button type="button" disabled={pending} onClick={() => change("applied")} className="pill text-sm text-ink-soft hover:text-ink">
            {t("reconsider")}
          </button>
        </>
      )}
      {pending && <LoaderCircle aria-hidden className="size-4 animate-spin text-ink-soft" />}
      {error}
    </div>
  );
}

function MeetingDialog({
  open,
  onClose,
  volunteerId,
  name,
  meeting,
}: {
  open: boolean;
  onClose: () => void;
  volunteerId: string;
  name: string;
  meeting: MeetingInfo | null;
}) {
  const tm = useTranslations("admin.meetings");
  const tAdmin = useTranslations("admin");
  const initial = meeting ? isoToIsraelLocal(meeting.scheduled_at) : { date: "", time: "" };
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [link, setLink] = useState(meeting?.link ?? "");
  const [note, setNote] = useState(meeting?.note ?? "");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminState>(null);

  const run = (fn: () => Promise<AdminState>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r?.ok) onClose();
    });

  const field = "mt-2 w-full rounded-2xl bg-surface-soft px-4 py-3 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary";

  return (
    <Modal open={open} onClose={onClose} title={meeting ? tm("editTitle", { name }) : tm("scheduleTitle", { name })} closeLabel={tm("close")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => scheduleMeeting({ volunteerId, date, time, link, note }));
        }}
        className="space-y-4"
      >
        <p className="text-sm text-ink-soft">{tm("timeZone")}</p>
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
          <label className="block">
            <span className="font-medium text-ink">{tm("date")}</span>
            <input type="date" required min={israelToday()} value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className={`${field} [direction:ltr] rtl:text-right`} />
          </label>
          <div>
            <label htmlFor={`meeting-time-${volunteerId}`} className="font-medium text-ink">
              {tm("time")}
            </label>
            <TimeSelect id={`meeting-time-${volunteerId}`} value={time} onChange={setTime} required className={field} />
          </div>
        </div>
        <label className="block">
          <span className="font-medium text-ink">
            {tm("link")} <span className="font-normal text-ink-soft">({tm("optional")})</span>
          </span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            dir="ltr"
            className={field}
          />
          <span className="mt-1 block text-sm text-ink-soft">{tm("linkHint")}</span>
        </label>
        <label className="block">
          <span className="font-medium text-ink">
            {tm("note")} <span className="font-normal text-ink-soft">({tm("optional")})</span>
          </span>
          <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={`${field} resize-y`} />
          <span className="mt-1 block text-sm text-ink-soft">{tm("noteHint")}</span>
        </label>

        {result?.error && <Notice role="alert">{tAdmin(`errors.${result.error}`)}</Notice>}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {meeting ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => closeMeeting(volunteerId, "missed"))}
                className="pill bg-surface-soft px-4 py-2.5 text-ink hover:shadow-soft disabled:opacity-60"
              >
                {tm("missed")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => closeMeeting(volunteerId, "cancelled"))}
                className="pill px-4 py-2.5 text-ink-soft hover:text-ink disabled:opacity-60"
              >
                {tm("cancelMeeting")}
              </button>
            </div>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={pending}
            className="pill bg-primary px-5 py-3 text-base text-primary-ink shadow-soft hover:bg-primary-hover disabled:opacity-60"
          >
            {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {meeting ? tm("saveChanges") : tm("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
