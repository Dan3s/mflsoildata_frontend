import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { canUpload, canManageCatalog, isAdmin } from "@/app/lib/roles";
import { readGlobalFilters } from "@/app/lib/globalFilters";
import { dashboardService, mapService } from "@/app/services";
import MapView from "../components/MapView";
import VisualizationSection from "../components/VisualizationSection";
import UploadView from "../components/UploadView";
import DownloadView from "../components/DownloadView";

const SECTION_SLUGS = ["map", "upload", "download", "ai"] as const;

export default async function DashboardSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("section");
  const isKnownSection = (SECTION_SLUGS as readonly string[]).includes(slug);

  if (slug === "visualization") {
    const query = await searchParams;
    const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
    const initialProjectId = first(query.project_id);
    const initialSiteId = first(query.site_id);
    const initialSiteCode = first(query.site_code);
    const initialVariableId = first(query.variable_id);
    const initialMatrix = first(query.matrix);

    const [projectOptionsResult, variablesResult] = await Promise.allSettled([
      dashboardService.getProjectsOptions(),
      dashboardService.getVariables(),
    ]);

    const projectOptions = projectOptionsResult.status === "fulfilled" ? projectOptionsResult.value : [];
    const variables = variablesResult.status === "fulfilled" ? variablesResult.value : [];
    const globalFilters = await readGlobalFilters();

    return (
      <VisualizationSection
        projectOptions={projectOptions}
        variables={variables}
        initialProjectId={initialProjectId}
        initialSiteId={initialSiteId}
        initialSiteCode={initialSiteCode}
        initialVariableId={initialVariableId}
        initialMatrix={initialMatrix}
        initialInstitution={globalFilters.institution}
      />
    );
  }

  if (slug === "map") {
    const query = await searchParams;
    const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
    const projectParam = Number(first(query.project_id));
    const initialProjectId = Number.isFinite(projectParam) && projectParam > 0 ? String(projectParam) : "";
    const globalFilters = await readGlobalFilters();
    // The first paint has to show what the filters say: the inherited institution/country
    // used to be selected in the form while the map still listed every site.
    const scope = {
      institution: globalFilters.institution || undefined,
      country: globalFilters.country || undefined,
      project_id: initialProjectId ? Number(initialProjectId) : undefined,
    };
    const [projectOptionsResult, summaryResult, sitesResult, variableOptionsResult] = await Promise.allSettled([
      dashboardService.getProjectsOptions(),
      mapService.getSummary(scope),
      mapService.getSites(scope),
      dashboardService.getVariableOptions(),
    ]);

    const projectOptions = projectOptionsResult.status === "fulfilled" ? projectOptionsResult.value : [];
    const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
    const sites = sitesResult.status === "fulfilled" ? sitesResult.value.items : [];
    const variableOptions = variableOptionsResult.status === "fulfilled" ? variableOptionsResult.value : [];

    return (
      <MapView
        projectOptions={projectOptions}
        initialSummary={summary}
        initialSites={sites}
        variableOptions={variableOptions}
        initialInstitution={globalFilters.institution}
        initialCountry={globalFilters.country}
        initialProjectId={initialProjectId}
      />
    );
  }

  if (slug === "upload") {
    const session = await auth();
    if (!canUpload(session?.roles)) {
      return (
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold text-amber-800">{t("restrictedTitle")}</h1>
            <p className="mt-2 text-sm text-amber-700">{t("restrictedBody")}</p>
            <Link href="/dashboard" className="mt-4 inline-flex text-sm font-medium text-brand-800 hover:underline">
              {t("backToDashboard")}
            </Link>
          </div>
        </div>
      );
    }
    return <UploadView canManageCatalog={canManageCatalog(session?.roles)} />;
  }

  if (slug === "download") {
    const query = await searchParams;
    const projectParam = Number(Array.isArray(query.project_id) ? query.project_id[0] : query.project_id);
    const initialProjectId = Number.isFinite(projectParam) && projectParam > 0 ? projectParam : undefined;
    const [projectOptionsResult, variableOptionsResult, countryOptionsResult] = await Promise.allSettled([
      dashboardService.getProjectsOptions(),
      dashboardService.getVariableOptions(),
      dashboardService.getCountries(),
    ]);

    const projectOptions = projectOptionsResult.status === "fulfilled" ? projectOptionsResult.value : [];
    const variableOptions = variableOptionsResult.status === "fulfilled" ? variableOptionsResult.value : [];
    const countryOptions = countryOptionsResult.status === "fulfilled" ? countryOptionsResult.value : [];

    const session = await auth();
    const globalFilters = await readGlobalFilters();
    return (
      <DownloadView
        projectOptions={projectOptions}
        variableOptions={variableOptions}
        countryOptions={countryOptions}
        initialInstitution={globalFilters.institution}
        initialCountry={globalFilters.country}
        initialMatrix={globalFilters.matrix}
        initialProjectId={initialProjectId}
        isAdmin={isAdmin(session?.roles)}
      />
    );
  }

  if (!isKnownSection) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">{t("notFoundTitle")}</h1>
          <p className="mt-2 text-sm text-gray-500">{t("notFoundBody")}</p>
          <Link href="/dashboard" className="mt-4 inline-flex text-sm font-medium text-brand-800 hover:underline">
            {t("backToDashboard")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-gray-900">{t(`${slug}.title`)}</h1>
        <p className="mt-2 text-base text-gray-500">{t(`${slug}.description`)}</p>
      </div>
    </div>
  );
}