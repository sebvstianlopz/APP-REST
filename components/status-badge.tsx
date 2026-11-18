import { getTranslations } from "next-intl/server";
import type { RestaurantStatus } from "@/lib/types";

const STYLES: Record<RestaurantStatus, string> = {
  draft: "bg-surface-2 text-muted",
  pending_review: "bg-warn-soft text-warn",
  active: "bg-ok-soft text-ok",
  suspended: "bg-danger/10 text-danger",
};

export async function StatusBadge({ status, listed }: { status: RestaurantStatus; listed?: boolean }) {
  const t = await getTranslations("panel");
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className={`badge ${STYLES[status]}`}>{t(`status.${status}`)}</span>
      {listed !== undefined && (
        <span className={`badge ${listed ? "bg-ok-soft text-ok" : "bg-surface-2 text-muted"}`}>
          {listed ? `● ${t("listed")}` : `○ ${t("notListed")}`}
        </span>
      )}
    </span>
  );
}
