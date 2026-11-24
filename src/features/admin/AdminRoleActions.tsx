"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle, ShieldCheck, ShieldMinus, ShieldPlus } from "lucide-react";
import { addAdmin, removeAdmin, type AdminState } from "./actions";

type Props = {
  id: string;
  name: string;
  /** null: not an admin. */
  role: "admin" | "root" | null;
  approved: boolean;
  viewerIsRoot: boolean;
  isSelf: boolean;
};

/** Admin badge on a volunteer's page, with "Make admin" (any admin) and "Remove admin" (root admins only). */
export function AdminRoleActions({ id, name, role, approved, viewerIsRoot, isSelf }: Props) {
  const t = useTranslations("admin.roles");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminState>(null);

  const run = (confirmText: string, fn: () => Promise<AdminState>) => {
    if (!window.confirm(confirmText)) return;
    start(async () => setResult(await fn()));
  };

  const canAdd = role === null && approved;
  const canRemove = role === "admin" && viewerIsRoot && !isSelf;
  if (role === null && !approved) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {role && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-ink">
          <ShieldCheck aria-hidden className="size-4 text-primary" />
          {t(role === "root" ? "root" : "admin")}
        </span>
      )}
      {canAdd && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(t("addConfirm", { name }), () => addAdmin(id))}
          className="pill bg-surface-soft px-4 py-2 text-ink hover:shadow-soft disabled:opacity-60"
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <ShieldPlus aria-hidden className="size-4" />}
          {t("add")}
        </button>
      )}
      {canRemove && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(t("removeConfirm", { name }), () => removeAdmin(id))}
          className="pill bg-surface-soft px-4 py-2 text-secondary hover:shadow-soft disabled:opacity-60"
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <ShieldMinus aria-hidden className="size-4" />}
          {t("remove")}
        </button>
      )}
      {result?.error && (
        <span role="alert" className="text-sm text-secondary">
          {t(`errors.${result.error === "forbidden" || result.error === "invalid" ? result.error : "failed"}`)}
        </span>
      )}
    </div>
  );
}
