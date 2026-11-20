import { getLocale, getTranslations } from "next-intl/server";
import { createSessionClient } from "@/lib/supabase/server";
import { pickBestMatches, scoreFit } from "@/features/matching/score";
import { daysSince, type OpenRequest, type VolunteerProfile } from "./model";
import { RequestsTabs, type BoardItem } from "./RequestsTabs";
import { errorMeta, logError } from "@/lib/logs";

/**
 * The dashboard's Opportunities tab: open requests in tabs (Best matches, Newest, All) with filters.
 * The volunteer's own requests live in the Activity tab.
 */
export async function OpenRequestsPanel({
  profile,
  atLimit,
}: {
  profile: VolunteerProfile;
  atLimit: boolean;
}) {
  const t = await getTranslations("requests");
  const locale = await getLocale();
  const supabase = await createSessionClient();

  const { data: open, error } = await supabase.rpc("list_open_requests");
  if (error) {
    await logError("requests", "system.rpc_failed", "[requests] list_open_requests failed", { fn: "list_open_requests", ...errorMeta(error) });
    return <p className="rounded-2xl bg-secondary-soft p-4 text-ink">{t("errors.failed")}</p>;
  }

  const openRequests = (open ?? []) as OpenRequest[];
  const rtf = new Intl.RelativeTimeFormat(locale === "he" ? "he" : "en", { numeric: "auto" });
  const waiting = (iso: string) => t("open.waiting", { time: rtf.format(-daysSince(iso), "day") });

  const ranked: BoardItem[] = openRequests
    .map((req) => ({ req, ...scoreFit(req, profile), waiting: waiting(req.created_at) }))
    // Best fit first; among equals, whoever has waited longest.
    .sort((a, b) => b.score - a.score || a.req.created_at.localeCompare(b.req.created_at));
  const bestMatches = pickBestMatches(ranked);

  return <RequestsTabs ranked={ranked} bestMatches={bestMatches} atLimit={atLimit} embedded />;
}
