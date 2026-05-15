"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { dashboardService, type FilterOption } from "@/app/services";

type DashboardFiltersProps = {
  initialValues: {
    search?: string;
    project_id?: string;
    site_id?: string;
    sample_type_id?: string;
    matrix?: string;
    variable_id?: string;
    date_from?: string;
    date_to?: string;
  };
  projectOptions: FilterOption[];
  siteOptions: FilterOption[];
  sampleTypeOptions: FilterOption[];
  matrixOptions: FilterOption[];
  variableOptions: FilterOption[];
};

const toNumber = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function DashboardFilters({
  initialValues,
  projectOptions,
  siteOptions,
  sampleTypeOptions,
  matrixOptions,
  variableOptions,
}: DashboardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(initialValues.project_id ?? "");
  const [siteId, setSiteId] = useState(initialValues.site_id ?? "");
  const [currentSiteOptions, setCurrentSiteOptions] = useState<FilterOption[]>(siteOptions);

  const currentValues = useMemo(
    () => ({
      search: initialValues.search ?? "",
      project_id: initialValues.project_id ?? "",
      site_id: initialValues.site_id ?? "",
      sample_type_id: initialValues.sample_type_id ?? "",
      matrix: initialValues.matrix ?? "",
      variable_id: initialValues.variable_id ?? "",
      date_from: initialValues.date_from ?? "",
      date_to: initialValues.date_to ?? "",
    }),
    [initialValues],
  );

  useEffect(() => {
    const selectedProject = toNumber(projectId);

    if (!selectedProject) {
      setCurrentSiteOptions([]);
      setSiteId("");
      return;
    }

    let cancelled = false;

    startTransition(() => {
      dashboardService
        .getSitesOptions(selectedProject)
        .then((options) => {
          if (!cancelled) {
            setCurrentSiteOptions(options);
            setSiteId((currentSite) => {
              const isStillValid = options.some((option) => String(option.id ?? option.label) === currentSite);
              return isStillValid ? currentSite : "";
            });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCurrentSiteOptions([]);
            setSiteId("");
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    setCurrentSiteOptions(siteOptions);
  }, [siteOptions]);

  useEffect(() => {
    setProjectId(initialValues.project_id ?? "");
    setSiteId(initialValues.site_id ?? "");
  }, [initialValues.project_id, initialValues.site_id]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    ["search", "project_id", "site_id", "sample_type_id", "matrix", "variable_id", "date_from", "date_to"].forEach((key) => {
      const value = formData.get(key)?.toString().trim();
      if (value) {
        params.set(key, value);
      }
    });

    startTransition(() => {
      router.push(params.toString() ? `/dashboard?${params.toString()}` : "/dashboard");
    });
  };

  const handleProjectChange = (value: string) => {
    setProjectId(value);
    setSiteId("");

    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("project_id", value);
    } else {
      params.delete("project_id");
      params.delete("site_id");
    }
    params.delete("site_id");

    startTransition(() => {
      router.replace(params.toString() ? `/dashboard?${params.toString()}` : "/dashboard");
    });
  };

  return (
    <form className="mt-6 grid gap-4 lg:grid-cols-4" onSubmit={handleSubmit}>
      <label className="block lg:col-span-2">
        <span className="mb-2 block text-sm text-gray-700">Búsqueda General</span>
        <input
          name="search"
          defaultValue={currentValues.search}
          placeholder="Buscar en todos los campos..."
          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-gray-700">Proyecto</span>
        <select
          name="project_id"
          value={projectId}
          onChange={(event) => handleProjectChange(event.target.value)}
          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white"
        >
          <option value="">Todos los proyectos</option>
          {projectOptions.map((option) => (
            <option key={option.id ?? option.label} value={option.id ?? option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-gray-700">Sitio</span>
        <select
          name="site_id"
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white"
          disabled={!projectId && currentSiteOptions.length === 0}
        >
          <option value="">{projectId ? "Todos los sitios" : "Seleccione un proyecto"}</option>
          {currentSiteOptions.map((option) => (
            <option key={option.id ?? option.label} value={option.id ?? option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-gray-700">Tipo de Muestra</span>
        <select
          name="sample_type_id"
          defaultValue={currentValues.sample_type_id}
          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white"
        >
          <option value="">Todos los tipos</option>
          {sampleTypeOptions.map((option) => (
            <option key={option.id ?? option.label} value={option.id ?? option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-gray-700">Matriz</span>
        <select
          name="matrix"
          defaultValue={currentValues.matrix}
          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white"
        >
          <option value="">Todas las matrices</option>
          {matrixOptions.map((option) => (
            <option key={option.code ?? option.label} value={option.code ?? option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-gray-700">Variable</span>
        <select
          name="variable_id"
          defaultValue={currentValues.variable_id}
          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white"
        >
          <option value="">Todas las variables</option>
          {variableOptions.map((option) => (
            <option key={option.id ?? option.label} value={option.id ?? option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-gray-700">Fecha Desde</span>
        <input
          name="date_from"
          type="date"
          defaultValue={currentValues.date_from}
          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-gray-700">Fecha Hasta</span>
        <input
          name="date_to"
          type="date"
          defaultValue={currentValues.date_to}
          className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:bg-white"
        />
      </label>

      <div className="flex gap-3 lg:col-span-2 lg:col-start-2">
        <button type="submit" disabled={isPending} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-60">
          Aplicar Filtros
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Limpiar Filtros
        </button>
      </div>
    </form>
  );
}