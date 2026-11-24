import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createSessionClient, getCurrentUser } from "@/lib/supabase/server";
import type { VolunteerStatus } from "@/features/volunteer/schema";

export type Viewer = {
  userId: string;
  email: string | undefined;
  isAdmin: boolean;
  /** Root admins can also remove admins that were added. */
  isRoot: boolean;
  volunteer: { full_name: string; status: VolunteerStatus } | null;
};

/** The signed-in person with their volunteer row and admin flag, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Per-visitor data: opt this page out of static pre-rendering, even though the locale layout enables it.
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createSessionClient();
  const [{ data: volunteer }, { data: admin }] = await Promise.all([
    supabase.from("volunteers").select("full_name, status").eq("id", user.id).maybeSingle(),
    // Everyone may read their own admins row (Row Level Security), so this is the admin check.
    supabase.from("admins").select("is_root").eq("user_id", user.id).maybeSingle<{ is_root: boolean }>(),
  ]);
  return { userId: user.id, email: user.email, isAdmin: !!admin, isRoot: admin?.is_root === true, volunteer };
});
