import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createSessionClient, getCurrentUser } from "@/lib/supabase/server";
import type { VolunteerStatus } from "@/features/volunteer/schema";

export type Viewer = {
  userId: string;
  email: string | undefined;
  isAdmin: boolean;
  volunteer: { full_name: string; status: VolunteerStatus } | null;
};

/** The signed-in person with their volunteer row and admin flag, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Per-visitor data: opt this page out of static pre-rendering, even though the locale layout enables it.
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createSessionClient();
  const [{ data: volunteer }, { data: isAdmin }] = await Promise.all([
    supabase.from("volunteers").select("full_name, status").eq("id", user.id).maybeSingle(),
    supabase.rpc("is_admin"),
  ]);
  return { userId: user.id, email: user.email, isAdmin: isAdmin === true, volunteer };
});
