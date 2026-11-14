import type { VolunteerStatus } from "@/features/volunteer/schema";

/** Tabs on the admin volunteers page. */
export const VOLUNTEER_VIEWS = ["pending", "verified", "rejected"] as const;
export type VolunteerView = (typeof VOLUNTEER_VIEWS)[number];

/** Which tab a volunteer belongs to. */
export function viewForStatus(status: VolunteerStatus): VolunteerView {
  return status === "approved" ? "verified" : status === "not_approved" ? "rejected" : "pending";
}
