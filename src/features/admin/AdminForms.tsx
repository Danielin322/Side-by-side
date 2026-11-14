"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check, LoaderCircle } from "lucide-react";
import { saveAdminNotes, type AdminState } from "./actions";

function Feedback({ state }: { state: AdminState }) {
  const t = useTranslations("admin");
  if (state?.ok)
    return (
      <span role="status" className="inline-flex items-center gap-1 text-sm text-primary">
        <Check aria-hidden className="size-4" />
        {t("saved")}
      </span>
    );
  if (state?.error)
    return (
      <span role="alert" className="text-sm text-secondary">
        {t(`errors.${state.error}`)}
      </span>
    );
  return null;
}

export function NotesForm({ id, notes }: { id: string; notes: string }) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(saveAdminNotes, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <label htmlFor="notes" className="block font-medium text-ink">
        {t("detail.notes")}
      </label>
      <p className="mt-1 text-sm text-ink-soft">{t("detail.notesHint")}</p>
      <textarea
        id="notes"
        name="notes"
        rows={5}
        maxLength={4000}
        defaultValue={notes}
        className="mt-3 w-full resize-y rounded-2xl bg-surface-soft px-4 py-3 text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-secondary"
      />
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="pill bg-primary px-5 py-3 text-base text-primary-ink hover:bg-primary-hover disabled:opacity-70">
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {t("detail.saveNotes")}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
