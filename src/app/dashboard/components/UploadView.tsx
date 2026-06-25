"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Upload, CheckCircle, XCircle, Download, Loader2, AlertTriangle, Plus, X } from "lucide-react";
import type {
  FilterOption,
  TemplateColumn,
  TemplateColumnGroup,
  UploadValidationResponse,
  UploadImportResponse,
} from "@/app/services";
import { ApiError, uploadService, variablesService } from "@/app/services";

const MATRIX_OPTIONS = ["SOIL", "LEAF", "GRAIN", "SOIL_PROFILE", "SOIL_HORIZON"];
const VALUE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "numeric", label: "Numérico" },
  { value: "text", label: "Texto" },
  { value: "boolean", label: "Booleano" },
  { value: "date", label: "Fecha" },
];

/** Mirror of the API's code normalization (uppercase, no accents, symbols -> _). */
const normalizeCode = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

// ── Types ────────────────────────────────────────────────────────────────────

type Step = "plantilla" | "cargar" | "validacion";

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "plantilla", label: "1. Generar Plantilla" },
    { id: "cargar", label: "2. Cargar Datos" },
    { id: "validacion", label: "3. Validación" },
  ];

  return (
    <div className="flex gap-1 rounded-full border border-gray-200 bg-gray-50 p-1 w-fit">
      {steps.map((s) => (
        <span
          key={s.id}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            current === s.id
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500"
          }`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

function ColumnCheckbox({
  column,
  checked,
  onChange,
}: {
  column: TemplateColumn;
  checked: boolean;
  onChange: (id: string, checked: boolean) => void;
}) {
  const disabled = column.required;

  return (
    <label
      className={`flex items-center gap-3 py-3 px-1 border-b border-gray-100 last:border-0 ${
        disabled ? "cursor-default" : "cursor-pointer"
      }`}
    >
      <div className="relative flex items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(column.id, e.target.checked)}
          className="sr-only"
        />
        <div
          className={`h-5 w-5 rounded flex items-center justify-center border transition-colors ${
            checked
              ? disabled
                ? "border-gray-400 bg-gray-400"
                : "border-green-600 bg-green-600"
              : "border-gray-300 bg-white"
          }`}
        >
          {checked && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-700">{column.label}</span>
      {column.unit && <span className="text-xs text-gray-400">({column.unit})</span>}
      {column.required && (
        <span className="text-xs text-red-500 ml-1">(Obligatorio)</span>
      )}
    </label>
  );
}

// ── Step 1: Generar Plantilla ─────────────────────────────────────────────────

function StepPlantilla({
  groups,
  loading,
  error,
  selected,
  onToggle,
  totalColumns,
  onDownload,
  onNext,
  onNewVariable,
  allSelected,
  onToggleAll,
}: {
  groups: TemplateColumnGroup[];
  loading: boolean;
  error: string | null;
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  totalColumns: number;
  onDownload: () => void;
  onNext: () => void;
  onNewVariable: () => void;
  allSelected: boolean;
  onToggleAll: (selectAll: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Info card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Generar Plantilla de Carga
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Seleccione las columnas que necesita para su archivo de carga. Las columnas
          marcadas como obligatorias no pueden desactivarse.
        </p>

        <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Info className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-700">Información</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Las columnas se generan a partir del esquema actual de la base de datos
              (proyecto, sitio, evento, muestra y variables). Los campos obligatorios
              están preseleccionados y no pueden ser removidos.
            </p>
          </div>
        </div>
      </div>

      {/* Columns selector */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900">Columnas de la plantilla</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleAll(!allSelected)}
              disabled={loading || totalColumns === 0}
              className="text-sm font-medium text-green-700 hover:text-green-800 disabled:opacity-40 transition-colors"
            >
              {allSelected ? "Quitar todos" : "Seleccionar todos"}
            </button>
            <span className="text-gray-300">·</span>
            <button
              type="button"
              onClick={onNewVariable}
              className="inline-flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nueva variable
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando columnas disponibles…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="text-base font-semibold text-gray-900">{group.label}</h3>
                {group.description && (
                  <p className="text-sm text-gray-500 mb-2">{group.description}</p>
                )}
                <div className="divide-y divide-gray-100">
                  {group.columns.map((col) => (
                    <ColumnCheckbox
                      key={col.id}
                      column={col}
                      checked={selected.has(col.id)}
                      onChange={onToggle}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-gray-700">Columnas seleccionadas</p>
          <p className="text-sm text-gray-500">
            {selected.size} de {totalColumns} columnas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNext}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Ya tengo la plantilla
          </button>
          <button
            onClick={onDownload}
            disabled={loading || selected.size === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 active:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            Descargar Plantilla Excel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Cargar Datos ──────────────────────────────────────────────────────

function StepCargar({
  file,
  onFile,
  onValidate,
  validating,
  error,
}: {
  file: File | null;
  onFile: (file: File) => void;
  onValidate: () => void;
  validating: boolean;
  error: string | null;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) onFile(dropped);
    },
    [onFile],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Cargar Archivo</h2>
        <p className="text-sm text-gray-500 mb-6">
          Suba el archivo Excel completado con sus datos de muestreo.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-colors ${
            isDragging
              ? "border-green-500 bg-green-50"
              : file
              ? "border-green-400 bg-green-50"
              : "border-gray-200 bg-gray-50 hover:border-gray-300"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className={`rounded-full p-3 ${file ? "bg-green-100" : "bg-white border border-gray-200"}`}>
            {file ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <Upload className="h-6 w-6 text-gray-400" />
            )}
          </div>
          {file ? (
            <>
              <p className="text-sm font-medium text-green-700">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)} KB — haz clic para cambiar
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                Arrastra tu archivo aquí o{" "}
                <span className="text-green-600 underline">selecciona uno</span>
              </p>
              <p className="text-xs text-gray-400">Soporta .xlsx, .xls, .csv</p>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          disabled={!file || validating}
          onClick={onValidate}
          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {validating && <Loader2 className="h-4 w-4 animate-spin" />}
          {validating ? "Validando…" : "Validar y Continuar"}
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Validación ────────────────────────────────────────────────────────

function StepValidacion({
  result,
  importing,
  importResult,
  importError,
  onBack,
  onImport,
}: {
  result: UploadValidationResponse;
  importing: boolean;
  importResult: UploadImportResponse | null;
  importError: string | null;
  onBack: () => void;
  onImport: () => void;
}) {
  const hasErrors = result.error_count > 0;
  const hasWarnings = result.warning_count > 0;

  if (importResult) {
    const inserted = importResult.inserted;
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-700">
                {importResult.message ?? "Importación completada"}
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                {importResult.skipped_rows > 0
                  ? `${importResult.skipped_rows} fila(s) omitida(s).`
                  : "Todos los registros válidos fueron importados."}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Registros insertados</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Object.entries(inserted).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, " ")}</p>
                <p className="text-lg font-semibold text-gray-900">{value ?? 0}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className={`rounded-2xl border p-6 shadow-sm ${hasErrors ? "border-red-200 bg-red-50" : hasWarnings ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}`}>
        <div className="flex items-start gap-3">
          {hasErrors ? (
            <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
          ) : hasWarnings ? (
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-semibold ${hasErrors ? "text-red-700" : hasWarnings ? "text-yellow-700" : "text-green-700"}`}>
              {hasErrors
                ? "Se encontraron errores en el archivo"
                : hasWarnings
                ? "Archivo válido con advertencias"
                : "Archivo válido — listo para importar"}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              {result.valid_rows} de {result.total_rows} filas válidas
              {result.error_count > 0 && ` · ${result.error_count} error(es)`}
              {result.warning_count > 0 && ` · ${result.warning_count} advertencia(s)`}
            </p>
          </div>
        </div>
      </div>

      {/* Affected entities preview */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Se crearían / actualizarían</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Object.entries(result.summary).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, " ")}</p>
              <p className="text-lg font-semibold text-gray-900">{value ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Issues table */}
      {result.issues.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Detalle de incidencias</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Fila</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Columna</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Mensaje</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.issues.map((e, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-700 font-mono">{e.row}</td>
                  <td className="px-6 py-3 text-gray-700">{e.column}</td>
                  <td className="px-6 py-3 text-gray-500 font-mono">{e.value ?? "—"}</td>
                  <td className="px-6 py-3 text-gray-700">{e.message}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.severity === "error"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {e.severity === "error" ? "Error" : "Advertencia"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importError && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {importError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Volver a Cargar
        </button>
        <button
          disabled={hasErrors || importing}
          onClick={onImport}
          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing ? "Importando…" : "Importar Datos"}
        </button>
      </div>
    </div>
  );
}

// ── New variable modal ────────────────────────────────────────────────────────

function NewVariableModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (variableId: number, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const [valueType, setValueType] = useState("numeric");
  const [matrix, setMatrix] = useState("");
  const [domain, setDomain] = useState("custom");
  const [unitId, setUnitId] = useState("");
  const [units, setUnits] = useState<FilterOption[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([variablesService.getUnits(), variablesService.getDomains()]).then(
      ([unitsResult, domainsResult]) => {
        if (!active) return;
        if (unitsResult.status === "fulfilled") setUnits(unitsResult.value);
        if (domainsResult.status === "fulfilled") setDomains(domainsResult.value);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!codeEdited) setCode(normalizeCode(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = normalizeCode(code || name);
    if (!name.trim() || !finalCode) {
      setError("Indique al menos un nombre.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const variable = await variablesService.create({
        variable_code: finalCode,
        name: name.trim(),
        domain: domain.trim() || "custom",
        value_type: valueType,
        matrix: matrix || null,
        default_unit_id: unitId ? Number(unitId) : null,
      });
      onCreated(variable.id, variable.name);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "No se pudo crear la variable.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Nueva variable</h3>
            <p className="text-sm text-gray-500">
              Se agrega al catálogo y queda disponible como columna de la plantilla.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="p. ej. Boro disponible"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Código</label>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeEdited(true);
              }}
              placeholder="BORO_DISPONIBLE"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <p className="mt-1 text-xs text-gray-400">Se normaliza automáticamente (mayúsculas, sin tildes, _).</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de valor *</label>
              <select
                value={valueType}
                onChange={(e) => setValueType(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                {VALUE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Matriz</label>
              <select
                value={matrix}
                onChange={(e) => setMatrix(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="">—</option>
                {MATRIX_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Dominio</label>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                list="variable-domains"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <datalist id="variable-domains">
                {domains.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Unidad</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="">—</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Creando…" : "Crear variable"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UploadView() {
  const [step, setStep] = useState<Step>("plantilla");

  // Step 1 — template columns
  const [groups, setGroups] = useState<TemplateColumnGroup[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(true);
  const [columnsError, setColumnsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Step 2 — file + validation
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validation, setValidation] = useState<UploadValidationResponse | null>(null);

  // Step 3 — import
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<UploadImportResponse | null>(null);

  // New variable modal
  const [showNewVariable, setShowNewVariable] = useState(false);

  const allColumns = useMemo(() => groups.flatMap((g) => g.columns), [groups]);

  /**
   * Load the template column catalog. On the first load required columns are
   * preselected; on a refresh (e.g. after creating a variable) the current
   * selection is preserved and ``selectId`` is added.
   */
  const loadColumns = useCallback(async (selectId?: string) => {
    setLoadingColumns(true);
    setColumnsError(null);
    try {
      const response = await uploadService.getTemplateColumns();
      setGroups(response.groups);
      setSelected((prev) => {
        const required = response.groups
          .flatMap((g) => g.columns)
          .filter((c) => c.required)
          .map((c) => c.id);
        const next = prev.size === 0 ? new Set(required) : new Set(prev);
        if (selectId) next.add(selectId);
        return next;
      });
    } catch (err) {
      setColumnsError(
        err instanceof Error ? err.message : "No se pudieron cargar las columnas de la plantilla.",
      );
    } finally {
      setLoadingColumns(false);
    }
  }, []);

  useEffect(() => {
    loadColumns();
  }, [loadColumns]);

  const handleVariableCreated = (variableId: number) => {
    setShowNewVariable(false);
    void loadColumns(`var:${variableId}`);
  };

  const handleToggleAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelected(new Set(allColumns.map((column) => column.id)));
    } else {
      // Required columns can't be deselected, so keep them.
      setSelected(new Set(allColumns.filter((column) => column.required).map((column) => column.id)));
    }
  };

  const allSelected = allColumns.length > 0 && selected.size === allColumns.length;

  const handleToggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDownloadTemplate = () => {
    const url = uploadService.buildTemplateUrl({
      columns: Array.from(selected),
      format: "xlsx",
      include_examples: true,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setValidateError(null);
    try {
      const result = await uploadService.validate(file, { columns: Array.from(selected) });
      setValidation(result);
      setImportResult(null);
      setImportError(null);
      setStep("validacion");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "No se pudo validar el archivo.";
      setValidateError(message);
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validation) return;
    setImporting(true);
    setImportError(null);
    try {
      const result = await uploadService.commit({
        upload_id: validation.upload_id,
        ignore_warnings: true,
      });
      setImportResult(result);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "No se pudo importar el archivo.";
      setImportError(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Carga de Datos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Importar datos desde archivos Excel usando plantillas personalizables
        </p>
      </div>

      {/* Steps */}
      <div className="mb-6">
        <StepIndicator current={step} />
      </div>

      {/* Content */}
      {step === "plantilla" && (
        <StepPlantilla
          groups={groups}
          loading={loadingColumns}
          error={columnsError}
          selected={selected}
          onToggle={handleToggle}
          totalColumns={allColumns.length}
          onDownload={handleDownloadTemplate}
          onNext={() => setStep("cargar")}
          onNewVariable={() => setShowNewVariable(true)}
          allSelected={allSelected}
          onToggleAll={handleToggleAll}
        />
      )}
      {step === "cargar" && (
        <StepCargar
          file={file}
          onFile={setFile}
          onValidate={handleValidate}
          validating={validating}
          error={validateError}
        />
      )}
      {step === "validacion" && validation && (
        <StepValidacion
          result={validation}
          importing={importing}
          importResult={importResult}
          importError={importError}
          onBack={() => setStep("cargar")}
          onImport={handleImport}
        />
      )}

      {showNewVariable && (
        <NewVariableModal
          onClose={() => setShowNewVariable(false)}
          onCreated={handleVariableCreated}
        />
      )}
    </div>
  );
}
