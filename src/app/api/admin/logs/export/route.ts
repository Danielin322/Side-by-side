import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import {
  applyLogFilters,
  LOG_COLUMNS,
  LOGS_EXPORT_LIMIT,
  logsToCsv,
  parseLogFilters,
  type LogRow,
} from "@/features/admin/logs";

/** CSV of the admin logs, with the same filters as the Logs screen (newest first, up to 10,000 rows). */
export async function GET(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return new NextResponse("Forbidden", { status: 403 });

  const filters = parseLogFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { data, error } = await applyLogFilters(supabase.from("system_logs").select(LOG_COLUMNS), filters)
    .order("created_at", { ascending: false })
    .limit(LOGS_EXPORT_LIMIT)
    .returns<LogRow[]>();
  if (error) return new NextResponse("Export failed", { status: 500 });

  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel opens Hebrew text as UTF-8.
  return new NextResponse("﻿" + logsToCsv(data ?? []), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filters.view === "audit" ? "audit-log" : "event-log"}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
