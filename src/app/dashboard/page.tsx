import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { canUpload, canManageCatalog } from "@/app/lib/roles";
import { readGlobalFilters } from "@/app/lib/globalFilters";
import { dashboardService, datasetService } from "@/app/services";
import type { DatasetCatalogueItem } from "@/app/services";
import DashboardFilters from "./components/DashboardFilters";
import DatasetCatalogue from "./components/DatasetCatalogue";
import { yearMatches, yearOptionsFrom } from "./components/datasetYear";
import { FieldHelp } from "./components/FieldHelp";

type DashboardSearchParams = {
  institution?: string;
  matrix?: string;
  year?: string;
};

const formatNumber = (value: number | undefined | null, locale: string) => {
  if (value === undefined || value === null) {
    return "—";
  }

  return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-CO").format(value);
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const normalizedParams: DashboardSearchParams = await (searchParams ?? Promise.resolve<DashboardSearchParams>({}));
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const session = await auth();
  const globalFilters = await readGlobalFilters();

  // The URL wins over the cookie (so a shared `?institution=X` link keeps working);
  // the cookie only fills in when the URL doesn't say anything (see lib/globalFilters.ts).
  const institution = normalizedParams.institution ?? globalFilters.institution ?? "";
  const matrix = normalizedParams.matrix ?? globalFilters.matrix ?? "";
  const year = normalizedParams.year ?? "";

  const [summaryResult, institutionsResult, itemsResult, projectsResult] = await Promise.allSettled([
    dashboardService.getSummary(institution || undefined),
    dashboardService.getInstitutionOptions(),
    datasetService.getCatalogue(),
    dashboardService.getProjectsOptions(),
  ]);

  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
  const institutionOptions = institutionsResult.status === "fulfilled" ? institutionsResult.value : [];
  const items: DatasetCatalogueItem[] = itemsResult.status === "fulfilled" ? itemsResult.value : [];
  // The catalogue lists every dataset (its ficha is public), but the data behind some is not
  // open to everyone: the explore links need to know which ones this user can actually open.
  const accessibleProjectIds =
    projectsResult.status === "fulfilled"
      ? projectsResult.value.map((p) => p.id).filter((id): id is number => typeof id === "number")
      : null;
  // Cascading filters: each selector counts the datasets that match the OTHER two, so it only
  // offers values that leave something on screen (and says how many).
  const matching = (skip: "institution" | "matrix" | "year") =>
    items.filter(
      (i) =>
        (skip === "institution" || !institution || i.data_source === institution) &&
        (skip === "matrix" || !matrix || (i.expected_matrices ?? []).includes(matrix)) &&
        (skip === "year" || !year || yearMatches(i, year)),
    );
  const tally = (values: string[]) => values.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});
  const institutionCounts = tally(matching("institution").map((i) => i.data_source ?? "").filter(Boolean));
  const matrixCounts = tally(matching("matrix").flatMap((i) => i.expected_matrices ?? []));
  const yearPool = matching("year");
  const yearOptions = yearOptionsFrom(yearPool);
  // A year already chosen stays selectable even when another filter now leaves no dataset in it.
  if (year && !yearOptions.includes(year)) yearOptions.unshift(year);
  const yearCounts = Object.fromEntries(yearOptions.map((y) => [y, yearPool.filter((i) => yearMatches(i, y)).length]));
  const countriesCount = new Set(items.flatMap((i) => i.countries ?? [])).size;

  const stats = [
    { key: "sites", label: t("stats.sites"), value: summary?.sites },
    { key: "samples", label: t("stats.samples"), value: summary?.samples },
    { key: "variables", label: t("stats.variables"), value: summary?.variables },
    { key: "datasets", label: t("stats.datasets"), value: items.length },
    { key: "countries", label: t("stats.countries"), value: countriesCount },
  ];

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-base text-gray-500">{t("subtitle")}</p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                {stat.label}
                <FieldHelp text={t(`stats.help.${stat.key}`)} />
              </div>
              <div className="mt-2 text-4xl font-light text-gray-900">{formatNumber(stat.value, locale)}</div>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-1 text-gray-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 5h16L14 13v6l-4 2v-8L4 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">{t("filtersTitle")}</h2>
              <p className="mt-1 text-sm text-gray-500">{t("filtersSubtitle")}</p>
            </div>
          </div>

          <DashboardFilters
            values={{ institution, matrix, year }}
            institutionOptions={institutionOptions}
            yearOptions={yearOptions}
            counts={{ institution: institutionCounts, matrix: matrixCounts, year: yearCounts }}
          />
        </section>

        <DatasetCatalogue
          initialItems={items}
          canEdit={canUpload(session?.roles)}
          canEditQc={canManageCatalog(session?.roles)}
          filters={{ institution, matrix, year }}
          accessibleProjectIds={accessibleProjectIds}
        />
      </div>
    </div>
  );
}
