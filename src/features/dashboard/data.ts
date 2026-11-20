import "server-only";
import { createSessionClient } from "@/lib/supabase/server";
import { israelToday, isoToIsraelLocal } from "@/lib/time";
import type { MeetingMode, SupportType } from "@/features/intake/schema";
import type { MyRequest, ReleaseReason } from "@/features/requests/model";
import type { StoredLanguage, VolunteerStatus } from "@/features/volunteer/schema";
import { errorMeta, logError } from "@/lib/logs";

/** The volunteer's own row (Row Level Security lets them read it). Sensitive data stays in volunteer_sensitive. */
export type VolunteerDetails = {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  occupation: string | null;
  availability: string[];
  commit_six_months: boolean;
  transport: ("license" | "car" | "public_transit")[];
  languages: StoredLanguage[];
  support_types: SupportType[];
  meeting_modes: Exclude<MeetingMode, "any">[];
  status: VolunteerStatus;
  created_at: string;
};

/** A request the volunteer completed or handed back (from list_my_history(), migration 0006). */
export type HistoryItem = {
  event_id: string;
  kind: "completed" | "released";
  request_id: string;
  first_name: string;
  support_types: SupportType[];
  meeting_mode: MeetingMode;
  accepted_at: string | null;
  ended_at: string;
  summary: string | null;
  reason: ReleaseReason | null;
};

/** Everything upcoming, verification chat and request meetings together, soonest first. */
export type UpcomingMeeting =
  | { kind: "verification"; at: string; link: string | null; sortKey: string }
  | { kind: "request"; date: string; firstName: string; sortKey: string };

export type DashboardData = {
  details: VolunteerDetails;
  myRequests: MyRequest[];
  history: HistoryItem[] | null;
  meetings: UpcomingMeeting[];
  failed: boolean;
};

const DETAIL_COLUMNS =
  "full_name, email, phone, city, occupation, availability, commit_six_months, transport, languages, support_types, meeting_modes, status, created_at";

/** Loads the signed-in volunteer's dashboard. Returns null when they have no volunteer application. */
export async function loadDashboard(userId: string): Promise<DashboardData | null> {
  const supabase = await createSessionClient();
  const { data: details, error: detailsError } = await supabase
    .from("volunteers")
    .select(DETAIL_COLUMNS)
    .eq("id", userId)
    .maybeSingle<VolunteerDetails>();
  if (detailsError) await logError("volunteers", "system.rpc_failed", "[dashboard] volunteer load failed", errorMeta(detailsError));
  if (!details) return null;

  const approved = details.status === "approved";
  const [mine, history, meeting] = await Promise.all([
    // Only approved volunteers may hold requests; the function refuses everyone else.
    approved ? supabase.rpc("list_my_requests") : Promise.resolve({ data: [], error: null }),
    supabase.rpc("list_my_history"),
    details.status === "interview" ? supabase.rpc("get_my_meeting") : Promise.resolve({ data: [], error: null }),
  ]);

  if (mine.error) await logError("volunteers", "system.rpc_failed", "[dashboard] list_my_requests failed", { fn: "list_my_requests", ...errorMeta(mine.error) });
  // Before migration 0006 runs, history is missing: show a gentle note instead of breaking the page.
  if (history.error) await logError("volunteers", "system.rpc_failed", "[dashboard] list_my_history failed", { fn: "list_my_history", ...errorMeta(history.error) });
  if (meeting.error) await logError("volunteers", "system.rpc_failed", "[dashboard] get_my_meeting failed", { fn: "get_my_meeting", ...errorMeta(meeting.error) });

  const myRequests = (mine.data ?? []) as MyRequest[];
  const verification = ((meeting.data ?? []) as { scheduled_at: string; link: string | null }[])[0];

  const today = israelToday();
  const meetings: UpcomingMeeting[] = [
    ...(verification
      ? [
          {
            kind: "verification" as const,
            at: verification.scheduled_at,
            link: verification.link,
            sortKey: (({ date, time }) => `${date}T${time}`)(isoToIsraelLocal(verification.scheduled_at)),
          },
        ]
      : []),
    ...myRequests
      .filter((r) => r.next_meeting && r.next_meeting >= today)
      .map((r) => ({
        kind: "request" as const,
        date: r.next_meeting!,
        firstName: r.first_name,
        // Request meetings have no time, so they sort to the start of their day.
        sortKey: `${r.next_meeting}T00:00`,
      })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return {
    details,
    myRequests,
    history: history.error ? null : ((history.data ?? []) as HistoryItem[]),
    meetings,
    failed: !!mine.error,
  };
}
