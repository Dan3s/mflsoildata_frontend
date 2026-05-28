import Link from "next/link";
import { dashboardService, mapService } from "@/app/services";
import MapView from "../components/MapView";
import VisualizationView from "../components/VisualizationView";

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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = sectionMap[slug];

  if (slug === "visualizacion") {
    const [projectOptionsResult, variablesResult] = await Promise.allSettled([
      dashboardService.getProjectsOptions(),
      dashboardService.getVariables(),
    ]);

    const projectOptions = projectOptionsResult.status === "fulfilled" ? projectOptionsResult.value : [];
    const variables = variablesResult.status === "fulfilled" ? variablesResult.value : [];

    return <VisualizationView projectOptions={projectOptions} variables={variables} />;
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