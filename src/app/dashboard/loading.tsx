import { Loader2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Shown while a dashboard section fetches its data, so the click never feels ignored. */
export default async function DashboardLoading() {
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-3 text-gray-500" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{t("loading")}</span>
    </div>
  );
}
