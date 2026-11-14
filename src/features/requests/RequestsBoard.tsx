import { getLocale, getTranslations } from "next-intl/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getBestMatches } from "@/features/matching/getBestMatches";
import { MAX_ACTIVE_REQUESTS, daysSince, scoreFit, type MyRequest, type OpenRequest, type VolunteerProfile } from "./model";
import { MyRequestCard } from "./RequestCards";
import { RequestsTabs, type BoardItem } from "./RequestsTabs";

/** Approved volunteer's view: their requests first, then open requests in tabs (Best matches, Newest, All). */
export async function RequestsBoard({ userId }: { userId: string }) {
  const t = await getTranslations("requests");
  const locale = await getLocale();
  const supabase = await createSessionClient();

  const [{ data: profile }, { data: mine, error: mineError }, { data: open, error: openError }] = await Promise.all([
    supabase
      .from("volunteers")
      .select("city, languages, support_types, meeting_modes, availability, transport")
      .eq("id", userId)
      .single<VolunteerProfile>(),
    supabase.rpc("list_my_requests"),
    supabase.rpc("list_open_requests"),
  ]);

  if (mineError || openError || !profile) {
    console.error("[requests] board load failed:", mineError?.message, openError?.message);
    return <p className="mt-8 rounded-2xl bg-secondary-soft p-4 text-ink">{t("errors.failed")}</p>;
  }

  const myRequests = (mine ?? []) as MyRequest[];
  const atLimit = myRequests.length >= MAX_ACTIVE_REQUESTS;
  const openRequests = (open ?? []) as OpenRequest[];
  // Started now, not awaited: the promise streams to the "Best matches" tab while the rest of the board renders.
  const bestMatches = getBestMatches(userId, profile, openRequests);

  const rtf = new Intl.RelativeTimeFormat(locale === "he" ? "he" : "en", { numeric: "auto" });
  const waiting = (iso: string) => t("open.waiting", { time: rtf.format(-daysSince(iso), "day") });

  const ranked: BoardItem[] = openRequests
    .map((req) => ({ req, ...scoreFit(req, profile), waiting: waiting(req.created_at) }))
    // Best fit first; among equals, whoever has waited longest.
    .sort((a, b) => b.score - a.score || a.req.created_at.localeCompare(b.req.created_at));

  return (
    <>
      <section aria-labelledby="mine-title" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="mine-title" className="text-2xl font-semibold text-ink">
            {t("mine.title")}
          </h2>
          <p className="text-sm text-ink-soft">{t("mine.count", { count: myRequests.length, max: MAX_ACTIVE_REQUESTS })}</p>
        </div>
        {myRequests.length > 0 ? (
          <ul className="mt-5 space-y-5">
            {myRequests.map((req) => (
              <MyRequestCard key={req.id} req={req} />
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-3xl bg-surface-soft p-6 text-ink-soft">{t("mine.empty")}</p>
        )}
      </section>

      <RequestsTabs ranked={ranked} bestMatches={bestMatches} atLimit={atLimit} />
    </>
  );
}
