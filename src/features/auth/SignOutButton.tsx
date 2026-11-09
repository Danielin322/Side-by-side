import { getLocale, getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { signOut } from "./actions";

export async function SignOutButton() {
  const t = await getTranslations("auth");
  const locale = await getLocale();
  return (
    <form action={signOut}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className="pill text-ink-soft hover:bg-surface-soft hover:text-ink">
        <LogOut aria-hidden className="size-4 rtl:-scale-x-100" />
        {t("signOut")}
      </button>
    </form>
  );
}
