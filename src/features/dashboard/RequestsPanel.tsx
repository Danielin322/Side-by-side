import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { MAX_ACTIVE_REQUESTS, type MyRequest } from "@/features/requests/model";
import { MyRequestCard } from "@/features/requests/RequestCards";
import { Empty, Section } from "./ActivityPanel";

/** The "My requests" tab: the requests this volunteer is supporting right now, with contact details and checklists. */
export async function RequestsPanel({
  approved,
  myRequests,
  failed,
}: {
  approved: boolean;
  myRequests: MyRequest[];
  failed: boolean;
}) {
  const t = await getTranslations("dashboard.requests");
  const tReq = await getTranslations("requests");

  if (!approved) {
    return (
      <div className="flex items-start gap-5 rounded-3xl bg-surface-soft p-7">
        <Lock aria-hidden className="mt-1 size-6 shrink-0 text-ink-soft" />
        <p className="text-ink-soft">{t("locked")}</p>
      </div>
    );
  }

  return (
    <Section id="my-requests-title" title={t("title")} aside={tReq("mine.count", { count: myRequests.length, max: MAX_ACTIVE_REQUESTS })}>
      {failed ? (
        <p className="rounded-2xl bg-secondary-soft p-4 text-ink">{tReq("errors.failed")}</p>
      ) : myRequests.length > 0 ? (
        <ul className="space-y-5">
          {myRequests.map((req) => (
            <MyRequestCard key={req.id} req={req} />
          ))}
        </ul>
      ) : (
        <Empty>{t("empty")}</Empty>
      )}
    </Section>
  );
}
