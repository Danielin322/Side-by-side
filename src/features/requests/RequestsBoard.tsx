import { getLocale, getTranslations } from "next-intl/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getBestMatches } from "@/features/matching/getBestMatches";
import { daysSince, scoreFit, type OpenRequest, type VolunteerProfile } from "./model";
import { RequestsTabs, type BoardItem } from "./RequestsTabs";

/**
 * The dashboard's Opportunities tab: open requests in tabs (Best matches, Newest, All) with filters.
 * The volunteer's own requests live in the Activity tab.
 */
export async function OpenRequestsPanel({
  userId,
  profile,
  atLimit,
}: {
  userId: string;
  profile: VolunteerProfile;
  atLimit: boolean;
}) {
  const t = await getTranslations("requests");
  const locale = await getLocale();
  const supabase = await createSessionClient();

  const { data: open, error } = await supabase.rpc("list_open_requests");
  if (error) {
    console.error("[requests] list_open_requests failed:", error.code, error.message);
    return <p className="rounded-2xl bg-secondary-soft p-4 text-ink">{t("errors.failed")}</p>;
  }

  const openRequests = (open ?? []) as OpenRequest[];
  // Started now, not awaited: the promise streams to the "Best matches" tab while the rest of the page renders.
  const bestMatches = getBestMatches(userId, profile, openRequests);

  const rtf = new Intl.RelativeTimeFormat(locale === "he" ? "he" : "en", { numeric: "auto" });
  const waiting = (iso: string) => t("open.waiting", { time: rtf.format(-daysSince(iso), "day") });

  const ranked: BoardItem[] = openRequests
    .map((req) => ({ req, ...scoreFit(req, profile), waiting: waiting(req.created_at) }))
    // Best fit first; among equals, whoever has waited longest.
    .sort((a, b) => b.score - a.score || a.req.created_at.localeCompare(b.req.created_at));

  return <RequestsTabs ranked={ranked} bestMatches={bestMatches} atLimit={atLimit} embedded />;
}
