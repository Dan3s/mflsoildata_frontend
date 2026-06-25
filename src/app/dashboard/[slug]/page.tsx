import Link from "next/link";
import { auth } from "@/auth";
import { canUpload } from "@/app/lib/roles";
import { dashboardService, mapService } from "@/app/services";
import MapView from "../components/MapView";
import VisualizationView from "../components/VisualizationView";
import UploadView from "../components/UploadView";
import DownloadView from "../components/DownloadView";

const sectionMap: Record<string, { title: string; description: string }> = {
  mapa: {
    title: "Mapa Geográfico",
    description: "Esta vista se usará para capas, puntos y filtros espaciales.",
  },
  cargar: {
    title: "Cargar Datos",
    description: "Pantalla para importar archivos y validar estructuras antes de enviar al API.",
  },
  descargar: {
    title: "Descargar Datos",
    description: "Pantalla para exportaciones filtradas y descargas en CSV/XLSX.",
  },
  ia: {
    title: "Agente IA",
    description: "Pantalla para consultas asistidas sobre los datos disponibles.",
  },
};

export default async function DashboardSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const section = sectionMap[slug];

  if (slug === "visualizacion") {
    const query = await searchParams;
    const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
    const initialProjectId = first(query.project_id);
    const initialSiteId = first(query.site_id);
    const initialSiteCode = first(query.site_code);
    const initialVariableId = first(query.variable_id);

    const [projectOptionsResult, variablesResult] = await Promise.allSettled([
      dashboardService.getProjectsOptions(),
      dashboardService.getVariables(),
    ]);

    const projectOptions = projectOptionsResult.status === "fulfilled" ? projectOptionsResult.value : [];
    const variables = variablesResult.status === "fulfilled" ? variablesResult.value : [];

    return (
      <VisualizationView
        projectOptions={projectOptions}
        variables={variables}
        initialProjectId={initialProjectId}
        initialSiteId={initialSiteId}
        initialSiteCode={initialSiteCode}
        initialVariableId={initialVariableId}
      />
    );
  }

  if (slug === "mapa") {
    const [projectOptionsResult, summaryResult, sitesResult] = await Promise.allSettled([
      dashboardService.getProjectsOptions(),
      mapService.getSummary(),
      mapService.getSites(),
    ]);

    const projectOptions = projectOptionsResult.status === "fulfilled" ? projectOptionsResult.value : [];
    const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
    const sites = sitesResult.status === "fulfilled" ? sitesResult.value.items : [];

    return <MapView projectOptions={projectOptions} initialSummary={summary} initialSites={sites} />;
  }

  if (slug === "cargar") {
    const session = await auth();
    if (!canUpload(session?.roles)) {
      return (
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold text-amber-800">Acceso restringido</h1>
            <p className="mt-2 text-sm text-amber-700">
              La carga de datos está disponible solo para usuarios con rol Editor o Admin. Si necesitas
              acceso, solicita a un administrador que actualice tus permisos.
            </p>
            <Link href="/dashboard" className="mt-4 inline-flex text-sm font-medium text-green-700 hover:underline">
              Volver al dashboard
            </Link>
          </div>
        </div>
      );
    }
    return <UploadView />;
  }

  if (slug === "descargar") {
    const [projectOptionsResult, variableOptionsResult] = await Promise.allSettled([
      dashboardService.getProjectsOptions(),
      dashboardService.getVariableOptions(),
    ]);

    const projectOptions = projectOptionsResult.status === "fulfilled" ? projectOptionsResult.value : [];
    const variableOptions = variableOptionsResult.status === "fulfilled" ? variableOptionsResult.value : [];

    return <DownloadView projectOptions={projectOptions} variableOptions={variableOptions} />;
  }

  if (!section) {
    return (
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Sección no encontrada</h1>
          <p className="mt-2 text-sm text-gray-500">La ruta solicitada no existe en el menú actual.</p>
          <Link href="/dashboard" className="mt-4 inline-flex text-sm font-medium text-green-700 hover:underline">
            Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-gray-900">{section.title}</h1>
        <p className="mt-2 text-base text-gray-500">{section.description}</p>
      </div>
    </div>
  );
}