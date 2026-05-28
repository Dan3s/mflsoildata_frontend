import Link from "next/link";
import { dashboardService } from "@/app/services";
import DashboardFilters from "./components/DashboardFilters";

const badgeStyles: Record<string, string> = {
  Validado: "bg-green-100 text-green-700",
  Pendiente: "bg-gray-100 text-gray-600",
};

type DashboardSearchParams = {
  search?: string;
  project_id?: string;
  site_id?: string;
  sample_type_id?: string;
  matrix?: string;
  variable_id?: string;
  date_from?: string;
  date_to?: string;
};

const formatNumber = (value: number | undefined | null) => {
  if (value === undefined || value === null) {
    return "—";
  }

  return new Intl.NumberFormat("es-CO").format(value);
};

const formatValue = (value: string | number | boolean | null) => {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Sí" : "No";
  }

  return String(value);
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const normalizedParams: DashboardSearchParams = await (searchParams ?? Promise.resolve<DashboardSearchParams>({}));
  const selectedProjectId = normalizedParams.project_id ? Number(normalizedParams.project_id) : undefined;

  const queryFilters = {
    search: normalizedParams.search,
    project_id: selectedProjectId,
    site_id: normalizedParams.site_id ? Number(normalizedParams.site_id) : undefined,
    sample_type_id: normalizedParams.sample_type_id ? Number(normalizedParams.sample_type_id) : undefined,
    matrix: normalizedParams.matrix,
    variable_id: normalizedParams.variable_id ? Number(normalizedParams.variable_id) : undefined,
    date_from: normalizedParams.date_from,
    date_to: normalizedParams.date_to,
    limit: 25,
    skip: 0,
  };

  const [summaryResult, recordsResult, projectsResult, sitesResult, sampleTypesResult, matricesResult, variablesResult] =
    await Promise.allSettled([
    dashboardService.getSummary(),
    dashboardService.getRecords(queryFilters),
    dashboardService.getProjectsOptions(),
    selectedProjectId ? dashboardService.getSitesOptions(selectedProjectId) : Promise.resolve([]),
    dashboardService.getSampleTypes(),
    dashboardService.getMatrices(),
    dashboardService.getVariableOptions(),
  ]);

  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
  const records = recordsResult.status === "fulfilled" ? recordsResult.value.items : [];
  const totalRecords = recordsResult.status === "fulfilled" ? recordsResult.value.total : records.length;
  const projectOptions = projectsResult.status === "fulfilled" ? projectsResult.value : [];
  const siteOptions = sitesResult.status === "fulfilled" ? sitesResult.value : [];
  const sampleTypeOptions = sampleTypesResult.status === "fulfilled" ? sampleTypesResult.value : [];
  const matrixOptions = matricesResult.status === "fulfilled" ? matricesResult.value : [];
  const variableOptions = variablesResult.status === "fulfilled" ? variablesResult.value : [];

  const stats = [
    { label: "Proyectos", value: summary?.projects },
    { label: "Sitios", value: summary?.sites },
    { label: "Muestras", value: summary?.samples },
    { label: "Variables", value: summary?.variables },
    { label: "Mediciones", value: summary?.measurements },
  ];

  const exportUrl = dashboardService.exportRecords(queryFilters);

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-base text-gray-500">Exploración y consulta de datos de investigación</p>
          </div>

          <Link href={exportUrl} className="inline-flex w-fit items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-green-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 4v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Exportar Datos
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-400">{stat.label}</div>
              <div className="mt-2 text-4xl font-light text-gray-900">{formatNumber(stat.value)}</div>
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
              <h2 className="text-lg font-medium text-gray-900">Filtros de Búsqueda</h2>
              <p className="mt-1 text-sm text-gray-500">Filtre los datos por proyecto, sitio, tipo de muestra, matriz, variable y rango de fechas</p>
            </div>
          </div>

          <DashboardFilters
            initialValues={normalizedParams}
            projectOptions={projectOptions}
            siteOptions={siteOptions}
            sampleTypeOptions={sampleTypeOptions}
            matrixOptions={matrixOptions}
            variableOptions={variableOptions}
          />
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Resultados de Búsqueda</h2>
              <p className="text-sm text-gray-500">Mostrando {records.length} de {totalRecords} registros</p>
            </div>

            {recordsResult.status === "rejected" ? (
              <p className="text-sm text-amber-600">No se pudo cargar la consulta principal; revisa el endpoint /dashboard/records.</p>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  {[
                    "Código Muestra",
                    "Proyecto",
                    "Sitio",
                    "Tipo",
                    "Variable",
                    "Matriz",
                    "Valor",
                    "Unidad",
                    "Fecha",
                    "Laboratorio",
                    "Estado",
                  ].map((heading) => (
                    <th key={heading} className="border-b border-gray-200 px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <tr key={`${record.sample_code}-${record.variable_id}`} className="text-gray-700">
                      <td className="border-b border-gray-100 px-4 py-4 align-top">{record.sample_code}</td>
                      <td className="border-b border-gray-100 px-4 py-4 align-top">{record.project_name}</td>
                      <td className="border-b border-gray-100 px-4 py-4 align-top">{record.site_name}</td>
                      <td className="border-b border-gray-100 px-4 py-4 align-top">{record.sample_type}</td>
                      <td className="border-b border-gray-100 px-4 py-4 align-top">{record.variable_name}</td>
                      <td className="border-b border-gray-100 px-4 py-4 align-top">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{record.matrix}</span>
                      </td>
                      <td className="border-b border-gray-100 px-4 py-4 align-top">{formatValue(record.value)}</td>
                      <td className="border-b border-gray-100 px-4 py-4 align-top">{record.unit ?? "—"}</td>
                      <td className="border-b border-gray-100 px-4 py-4 align-top">{record.event_date ?? record.date ?? "—"}</td>
                      <td className="border-b border-gray-100 px-4 py-4 align-top">{record.laboratory ?? "—"}</td>
                      <td className="border-b border-gray-100 px-4 py-4 align-top">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badgeStyles[record.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-sm text-gray-500">
                      No hay registros disponibles para mostrar en este momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}