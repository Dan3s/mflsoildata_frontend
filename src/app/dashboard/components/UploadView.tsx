"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Info, Upload, Check, ArrowRight, CheckCircle, XCircle, Download, Loader2, AlertTriangle, Plus, X, ChevronDown, Search, Clock, ArrowRightLeft, ArrowLeft, Database, ExternalLink, FileText, Lock } from "lucide-react";
import type {
  AccessLevel,
  ColumnMappingEntry,
  DataverseFileInfo,
  DataversePreviewResponse,
  FilterOption,
  TemplateColumn,
  TemplateColumnGroup,
  UploadValidationResponse,
  UploadImportResponse,
  UserOption,
  AgrovocTerm,
} from "@/app/services";
import { ApiError, dataverseService, uploadService, userService, variablesService } from "@/app/services";
import ManualRegistration from "./ManualRegistration";
import ColumnGlossary from "./ColumnGlossary";
import KeywordsPicker from "./KeywordsPicker";
import { FieldHelp } from "./FieldHelp";
import { useDataverseDownload, type UseDataverseDownload } from "./useDataverseDownload";
import { DataverseGuestbookForm } from "./DataverseGuestbookForm";
import { MATRIX_OPTIONS } from "@/app/lib/matrixColors";
import { normalizeCode } from "@/app/lib/normalizeCode";
import { suggestMapping, type FileColumn } from "@/app/lib/columnMapping";

const VALUE_TYPE_KEYS = ["numeric", "text", "boolean", "date"] as const;

/** Triggers a real browser "save to disk" for an in-memory blob — the Dataverse
 * step's "download only" action, same as the standalone Dataverse browser. */
const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// ── Types ────────────────────────────────────────────────────────────────────

type Step = "metadata" | "plantilla" | "cargar" | "mapear" | "dataverse" | "validacion";

// ── Sub-components ────────────────────────────────────────────────────────────

const STEP_ORDER = ["metadata", "plantilla", "cargar", "validacion"] as const;

/**
 * Where the person is in the upload, and what is already done. Done steps are
 * ticked and can be revisited (nothing typed is lost); the current step is
 * ringed; the rest are dimmed. Once the upload has been sent everything reads as
 * done and the steps stop being links, so nothing can be re-submitted by accident.
 */
function StepIndicator({
  current,
  finished,
  onNavigate,
}: {
  current: Step;
  finished: boolean;
  onNavigate: (step: Step) => void;
}) {
  const t = useTranslations("upload.steps");
  const labels: Record<(typeof STEP_ORDER)[number], string> = {
    metadata: t("metadata"),
    plantilla: t("template"),
    cargar: t("upload"),
    validacion: t("validation"),
  };

  // "mapear"/"dataverse" are sub-states of "cargar" for indicator purposes —
  // they don't get their own step, they just keep "Archivo" as the current one.
  // "dataverse" is reachable from "metadata" too, but it's still about getting
  // a file in, so it keeps folding into "cargar" rather than "metadata".
  const effective = current === "mapear" || current === "dataverse" ? "cargar" : current;
  const currentIndex = STEP_ORDER.indexOf(effective as (typeof STEP_ORDER)[number]);

  return (
    <nav aria-label={t("navLabel")} className="rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm sm:px-8">
      <ol className="flex">
        {STEP_ORDER.map((id, index) => {
          const state = finished || index < currentIndex ? "completed" : index === currentIndex ? "current" : "pending";
          const isLast = index === STEP_ORDER.length - 1;
          const canGoBack = state === "completed" && !finished;
          const go = () => onNavigate(id);

          const circleBase = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full";
          const circleClass =
            state === "completed"
              ? `${circleBase} bg-brand-700 text-white`
              : state === "current"
              ? `${circleBase} border-2 border-blue-600 bg-white`
              : `${circleBase} bg-blue-200`;
          const circleContent =
            state === "completed" ? (
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
            ) : state === "current" ? (
              <span className="h-4 w-4 rounded-full bg-blue-600" />
            ) : null;

          const statusClass =
            state === "completed" ? "text-brand-700" : state === "current" ? "text-blue-700" : "text-gray-500";
          const statusText = state === "completed" ? t("completed") : state === "current" ? t("inProgress") : t("pending");

          const text = (
            <>
              <span className="block text-[11px] font-medium uppercase tracking-[0.15em] text-gray-500">
                {t("stepLabel", { n: index + 1 })}
              </span>
              <span className="mt-0.5 block text-sm font-semibold leading-snug text-gray-900 sm:text-base">{labels[id]}</span>
              <span className={`mt-1 block text-xs font-medium ${statusClass}`}>{statusText}</span>
            </>
          );

          return (
            <li key={id} className="min-w-0 flex-1" aria-current={state === "current" ? "step" : undefined}>
              <div className="flex items-center">
                {canGoBack ? (
                  <button
                    type="button"
                    onClick={go}
                    title={t("goBackTo", { step: labels[id] })}
                    aria-label={t("goBackTo", { step: labels[id] })}
                    className={`${circleClass} transition hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700`}
                  >
                    {circleContent}
                  </button>
                ) : (
                  <span className={circleClass}>{circleContent}</span>
                )}
                {isLast ? null : (
                  <span
                    aria-hidden
                    className="mx-3 h-0.5 flex-1 rounded-full"
                    style={{
                      background:
                        index < currentIndex || finished
                          ? "#15803d"
                          : index === currentIndex
                          ? "linear-gradient(to right, #1d4ed8 50%, #bfdbfe 50%)"
                          : "#bfdbfe",
                    }}
                  />
                )}
              </div>
              <div className="mt-3 pr-2">
                {canGoBack ? (
                  <button
                    type="button"
                    onClick={go}
                    title={t("goBackTo", { step: labels[id] })}
                    className="rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                  >
                    {text}
                  </button>
                ) : (
                  text
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
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
  const t = useTranslations("upload.template");
  const tu = useTranslations("upload");
  const disabled = column.required;
  // Structural columns have stable ids we can translate; attribute/variable
  // columns are user-created catalog data, so fall back to the API label.
  const columnLabel = tu.has(`columnLabels.${column.id}`) ? tu(`columnLabels.${column.id}`) : column.label;
  const columnHelp = tu.has(`columnHelp.${column.id}`) ? tu(`columnHelp.${column.id}`) : null;

  return (
    <label
      className={`relative flex items-center gap-3 py-3 px-1 border-b border-gray-100 last:border-0 ${
        disabled ? "cursor-default" : "cursor-pointer"
      }`}
    >
      {/* Transparent, in-place input (not sr-only) so focusing on click never
          scroll-jumps the page. */}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(column.id, e.target.checked)}
        className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      />
      <div className="flex items-center">
        <div
          className={`h-5 w-5 rounded flex items-center justify-center border transition-colors ${
            checked
              ? disabled
                ? "border-gray-400 bg-gray-400"
                : "border-brand-700 bg-brand-700"
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
      <span className="text-sm text-gray-700">{columnLabel}</span>
      {columnHelp && <FieldHelp text={columnHelp} />}
      {column.unit && <span className="text-xs text-gray-400">({column.unit})</span>}
      {column.required && (
        <span className="text-xs text-red-500 ml-1">({t("required")})</span>
      )}
    </label>
  );
}

// ── Step 0: Metadatos del dataset ─────────────────────────────────────────────

/**
 * First step in the wizard: capture the dataset's FAIR metadata before touching
 * any file. Reuses `DatasetFicha` as-is (same form used to render/edit a
 * dataset's ficha from the catalogue) — only the surrounding step chrome here
 * is new.
 */
function StepMetadata({
  ficha,
  onFichaChange,
  authorized,
  onAuthorizedChange,
  keywords,
  onKeywordsChange,
  onImportDataverse,
  onContinue,
  draftRestored,
  onDiscardDraft,
}: {
  ficha: FichaState;
  onFichaChange: (f: FichaState) => void;
  authorized: string[];
  onAuthorizedChange: (emails: string[]) => void;
  keywords: AgrovocTerm[];
  onKeywordsChange: (terms: AgrovocTerm[]) => void;
  onImportDataverse: () => void;
  onContinue: () => void;
  draftRestored: boolean;
  onDiscardDraft: () => void;
}) {
  const t = useTranslations("upload.template");
  const ti = useTranslations("upload.intro");
  const tf = useTranslations("upload.ficha");
  const td = useTranslations("datasets");
  const missing = fichaMissing(ficha);

  return (
    <div className="space-y-6">
      {draftRestored ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{tf("draftRestored")}</span>
          <button type="button" onClick={onDiscardDraft} className="font-medium underline underline-offset-2 hover:text-amber-950">
            {tf("discardDraft")}
          </button>
        </div>
      ) : null}

      {/* What is about to happen, before a single field: the people who got lost here did
          not know what the form was for or that someone reviews it afterwards. */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-gray-900">{ti("title")}</h2>
          <p className="mt-1 text-sm text-gray-700">
            {ti.rich("body", { b: (chunks) => <strong className="font-semibold">{chunks}</strong> })}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            {ti("bring")}
          </p>
        </div>
      </div>

      {/* Shortcut for data already published on Dataverse: prefills this form. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-900">{t("dataverseTitle")}</p>
          <p className="text-sm text-gray-700">{t("dataverseBody")}</p>
        </div>
        <button
          type="button"
          onClick={onImportDataverse}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-800 shadow-sm transition-colors hover:bg-brand-100"
        >
          <Database className="h-4 w-4" />
          {t("dataverseButton")}
        </button>
      </div>

      <DatasetFicha
        value={ficha}
        onChange={onFichaChange}
        authorized={authorized}
        onAuthorizedChange={onAuthorizedChange}
        keywords={keywords}
        onKeywordsChange={onKeywordsChange}
      />

      {/* Stays in view while the long form scrolls: always one click from the way forward,
          and always says what is still missing instead of just being greyed out. */}
      <div className="sticky bottom-3 z-10 rounded-2xl border border-gray-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            {missing.length > 0 ? (
              <p className="text-gray-700">
                <span className="font-medium">{tf("missingLabel")}</span>{" "}
                {missing.map((key) => td(`fields.${key}`)).join(", ")}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 font-medium text-brand-800">
                <CheckCircle className="h-4 w-4" aria-hidden />
                {tf("readyLabel")}
              </p>
            )}
            <p className="text-xs text-gray-500">{tf("autosaved")}</p>
          </div>
          <button
            type="button"
            disabled={missing.length > 0}
            onClick={onContinue}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            {tf("continueToUpload")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
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
  onOwnHeaders,
  onNewVariable,
  canManageCatalog,
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
  onOwnHeaders: () => void;
  onNewVariable: () => void;
  canManageCatalog: boolean;
  allSelected: boolean;
  onToggleAll: (selectAll: boolean) => void;
}) {
  const t = useTranslations("upload.template");
  const tu = useTranslations("upload");
  const [search, setSearch] = useState("");
  // Explicit open/closed overrides per group key; variable groups default closed.
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  // Structural/variable group labels are known keys; fall back to the API label.
  const groupLabel = (group: TemplateColumnGroup) =>
    tu.has(`groupLabels.${group.key}`) ? tu(`groupLabels.${group.key}`) : group.label;
  const groupDescription = (group: TemplateColumnGroup) => {
    const key = group.key.startsWith("variables_") ? "variables" : group.key;
    return tu.has(`groupDescriptions.${key}`) ? tu(`groupDescriptions.${key}`) : group.description;
  };
  const columnLabel = (column: TemplateColumn) =>
    tu.has(`columnLabels.${column.id}`) ? tu(`columnLabels.${column.id}`) : column.label;

  const q = search.trim().toLowerCase();
  const visibleGroups = groups
    .map((group) => ({
      group,
      columns: q ? group.columns.filter((c) => columnLabel(c).toLowerCase().includes(q)) : group.columns,
    }))
    .filter((entry) => entry.columns.length > 0);

  // Open when searching; otherwise use the user's override, else default (variable
  // groups closed to reduce scrolling, everything else open).
  const isOpen = (key: string) => (q ? true : key in openState ? openState[key] : !key.startsWith("variables_"));

  return (
    <div className="space-y-6">
      {/* Info card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {t("title")}
        </h2>
        <p className="text-sm text-gray-500 mb-4">{t("subtitle")}</p>

        <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Info className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-700">{t("infoTitle")}</p>
            <p className="text-sm text-gray-500 mt-0.5">{t("infoBody")}</p>
            <p className="text-sm text-gray-500 mt-2">
              <span className="font-medium text-gray-700">{t("newVariablesSheetTitle")}</span>{" "}
              {t("newVariablesSheetBody")}
            </p>
          </div>
        </div>

        {/* Whoever uploads is accountable for what they upload: say so before
            they start, not in a terms page nobody opens. */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-900">{t("disclaimerTitle")}</p>
            <p className="mt-0.5 text-sm text-amber-800/90">{t("disclaimerBody")}</p>
          </div>
        </div>

        {/* Anyone arriving with a filled template should not have to scroll past
            the whole column picker to find the way out of this step. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div>
            <p className="text-sm font-medium text-brand-900">{t("skipTitle")}</p>
            <p className="text-sm text-brand-900/80">{t("skipBody")}</p>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800"
          >
            <Upload className="h-4 w-4" />
            {t("haveTemplate")}
          </button>
        </div>

        {/* For files that don't use our column headers at all — map them instead
            of renaming the file by hand. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div>
            <p className="text-sm font-medium text-gray-800">{t("ownHeadersTitle")}</p>
            <p className="text-sm text-gray-500">{t("ownHeadersBody")}</p>
          </div>
          <button
            type="button"
            onClick={onOwnHeaders}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {t("ownHeadersButton")}
          </button>
        </div>
      </div>

      {/* Columns selector */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900">{t("columnsTitle")}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleAll(!allSelected)}
              disabled={loading || totalColumns === 0}
              className="text-sm font-medium text-brand-800 hover:text-brand-900 disabled:opacity-40 transition-colors"
            >
              {allSelected ? t("deselectAll") : t("selectAll")}
            </button>
            {canManageCatalog && (
              <>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={onNewVariable}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-100 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {t("newVariable")}
                </button>
              </>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loadingColumns")}
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            {groups.length > 0 ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-500 focus:bg-white"
                />
              </div>
            ) : null}

            {visibleGroups.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">{t("noMatches")}</p>
            ) : (
              visibleGroups.map(({ group, columns }) => {
                const open = isOpen(group.key);
                const selectedInGroup = group.columns.filter((c) => selected.has(c.id)).length;
                return (
                  <div key={group.key} className="rounded-xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => setOpenState((s) => ({ ...s, [group.key]: !open }))}
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                    >
                      <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`} />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900">{groupLabel(group)}</h3>
                        {group.description && <p className="text-xs text-gray-500">{groupDescription(group)}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">{selectedInGroup}/{group.columns.length}</span>
                    </button>
                    {open ? (
                      <div className="divide-y divide-gray-100 border-t border-gray-100 px-3">
                        {columns.map((col) => (
                          <ColumnCheckbox key={col.id} column={col} checked={selected.has(col.id)} onChange={onToggle} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-gray-700">{t("selectedColumns")}</p>
          <p className="text-sm text-gray-500">
            {t("columnsCount", { selected: selected.size, total: totalColumns })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onDownload}
            disabled={loading || selected.size === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-800 active:bg-brand-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            {t("downloadTemplate")}
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
  ownHeaders,
  onToggleOwnHeaders,
  headerRow,
  onHeaderRowChange,
  onValidate,
  onContinueToMapping,
  validating,
  parsing,
  parseError,
  error,
}: {
  file: File | null;
  onFile: (file: File) => void;
  ownHeaders: boolean;
  onToggleOwnHeaders: (value: boolean) => void;
  headerRow: number;
  onHeaderRowChange: (value: number) => void;
  onValidate: () => void;
  onContinueToMapping: () => void;
  validating: boolean;
  parsing: boolean;
  parseError: string | null;
  error: string | null;
}) {
  const t = useTranslations("upload.file");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = validating || parsing;

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
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t("title")}</h2>
        <p className="text-sm text-gray-500 mb-6">{t("subtitle")}</p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-colors ${
            isDragging
              ? "border-brand-500 bg-brand-50"
              : file
              ? "border-brand-400 bg-brand-50"
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
          <div className={`rounded-full p-3 ${file ? "bg-brand-100" : "bg-white border border-gray-200"}`}>
            {file ? (
              <CheckCircle className="h-6 w-6 text-brand-700" />
            ) : (
              <Upload className="h-6 w-6 text-gray-400" />
            )}
          </div>
          {file ? (
            <>
              <p className="text-sm font-medium text-brand-800">{file.name}</p>
              <p className="text-xs text-gray-500">
                {t("fileSize", { size: (file.size / 1024).toFixed(1) })}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                {t.rich("dropHint", { a: (chunks) => <span className="text-brand-700 underline">{chunks}</span> })}
              </p>
              <p className="text-xs text-gray-400">{t("supports")}</p>
            </>
          )}
        </div>

        {/* Column-mapping opt-in: for files that don't already use our headers
            (also reachable straight from here for the "ya tengo la plantilla"
            shortcut, which skips Step 1 entirely). */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <input
            id="own-headers-toggle"
            type="checkbox"
            checked={ownHeaders}
            onChange={(e) => onToggleOwnHeaders(e.target.checked)}
            className="mt-0.5 accent-brand-700"
          />
          <label htmlFor="own-headers-toggle" className="cursor-pointer text-sm text-gray-700">
            {t("ownHeadersToggle")}
          </label>
        </div>

        <div className="mt-4 sm:max-w-xs">
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("headerRowLabel")}</label>
          <input
            type="number"
            min={1}
            value={headerRow}
            onChange={(e) => onHeaderRowChange(Math.max(1, Number(e.target.value) || 1))}
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
          />
          <p className="mt-1 text-xs text-gray-400">{t("headerRowHint")}</p>
        </div>

        {(error || parseError) && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error || parseError}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          disabled={!file || busy}
          onClick={ownHeaders ? onContinueToMapping : onValidate}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {parsing ? t("parsingFile") : validating ? t("validating") : ownHeaders ? t("mapColumns") : t("validateContinue")}
        </button>
      </div>
    </div>
  );
}

// ── Step 2b: Mapear columnas propias ──────────────────────────────────────────

/** One row of the file being mapped — the user's real header, an example value, and its target. */
export type { FileColumn };

function MappingRow({
  column,
  groups,
  targetId,
  onChange,
  duplicate,
  suggested,
}: {
  column: FileColumn;
  groups: TemplateColumnGroup[];
  targetId: string;
  onChange: (index: number, targetId: string) => void;
  duplicate: boolean;
  suggested: boolean;
}) {
  const t = useTranslations("upload");
  const groupLabel = (group: TemplateColumnGroup) =>
    t.has(`groupLabels.${group.key}`) ? t(`groupLabels.${group.key}`) : group.label;
  const columnLabel = (col: TemplateColumn) =>
    t.has(`columnLabels.${col.id}`) ? t(`columnLabels.${col.id}`) : col.label;

  return (
    <div className={`grid grid-cols-1 gap-3 border-b border-gray-100 py-3 last:border-0 sm:grid-cols-2 ${duplicate ? "rounded-lg bg-red-50 px-2" : ""}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-800" title={column.header}>
          {column.header || t("mapping.emptyHeader")}
          {suggested ? (
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700">
              {t("mapping.suggested")}
            </span>
          ) : null}
        </p>
        {column.example && <p className="truncate text-xs text-gray-400" title={column.example}>{t("mapping.example", { value: column.example })}</p>}
      </div>
      <select
        value={targetId}
        onChange={(e) => onChange(column.index, e.target.value)}
        className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm outline-none focus:border-brand-400 focus:bg-white"
      >
        <option value="">{t("mapping.ignore")}</option>
        {groups.map((group) => (
          <optgroup key={group.key} label={groupLabel(group)}>
            {group.columns.map((col) => (
              <option key={col.id} value={col.id}>
                {columnLabel(col)}
                {col.required ? ` (${t("template.required")})` : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {duplicate && <p className="sm:col-span-2 text-xs text-red-600">{t("mapping.duplicateTarget")}</p>}
    </div>
  );
}

function StepMapear({
  groups,
  allColumns,
  fileColumns,
  mapping,
  onMappingChange,
  suggested,
  onBack,
  onContinue,
  validating,
  error,
}: {
  groups: TemplateColumnGroup[];
  allColumns: TemplateColumn[];
  fileColumns: FileColumn[];
  mapping: Record<number, string>;
  onMappingChange: (index: number, targetId: string) => void;
  suggested: Set<number>;
  onBack: () => void;
  onContinue: () => void;
  validating: boolean;
  error: string | null;
}) {
  const t = useTranslations("upload.mapping");
  const tu = useTranslations("upload");
  const columnLabel = (col: TemplateColumn) =>
    tu.has(`columnLabels.${col.id}`) ? tu(`columnLabels.${col.id}`) : col.label;

  const targetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const targetId of Object.values(mapping)) {
      if (!targetId) continue;
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
    }
    return counts;
  }, [mapping]);

  const mappedTargets = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);
  const missingRequired = useMemo(
    () => allColumns.filter((c) => c.required && !mappedTargets.has(c.id)),
    [allColumns, mappedTargets],
  );
  const hasDuplicates = useMemo(() => Array.from(targetCounts.values()).some((n) => n > 1), [targetCounts]);
  const mappedCount = mappedTargets.size;

  const canContinue = mappedCount > 0 && !hasDuplicates && missingRequired.length === 0 && !validating;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t("title")}</h2>
        <p className="text-sm text-gray-500 mb-4">{t("subtitle")}</p>

        <p className="mb-3 text-sm font-medium text-gray-700">
          {t("mappedProgress", { mapped: Object.values(mapping).filter(Boolean).length, total: fileColumns.length })}
        </p>
        {suggested.size > 0 ? (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("autoSuggested", { count: suggested.size })}
          </div>
        ) : null}

        <div className="max-h-[32rem] overflow-y-auto">
          {fileColumns.map((column) => {
            const targetId = mapping[column.index] ?? "";
            return (
              <MappingRow
                key={column.index}
                column={column}
                groups={groups}
                targetId={targetId}
                onChange={onMappingChange}
                duplicate={Boolean(targetId) && (targetCounts.get(targetId) ?? 0) > 1}
                suggested={suggested.has(column.index)}
              />
            );
          })}
        </div>

        {missingRequired.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {t("missingRequired", { fields: missingRequired.map(columnLabel).join(", ") })}
          </div>
        )}
        {mappedCount === 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {t("noneMapped")}
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </button>
        <button
          disabled={!canContinue}
          onClick={onContinue}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {validating && <Loader2 className="h-4 w-4 animate-spin" />}
          {validating ? t("validating") : t("continue")}
        </button>
      </div>
    </div>
  );
}

// ── Step 2c: Importar desde Dataverse ─────────────────────────────────────────

function StepDataverse({
  doi,
  onDoiChange,
  onSearch,
  searching,
  error,
  preview,
  dv,
  onBack,
  onDownloadFile,
  onMapFile,
  onMetadataOnly,
  mappingFileId,
}: {
  doi: string;
  onDoiChange: (value: string) => void;
  onSearch: () => void;
  searching: boolean;
  error: string | null;
  preview: DataversePreviewResponse | null;
  dv: UseDataverseDownload;
  onBack: () => void;
  onDownloadFile: (file: DataverseFileInfo) => void;
  onMapFile: (file: DataverseFileInfo) => void;
  onMetadataOnly: () => void;
  mappingFileId: number | null;
}) {
  const t = useTranslations("upload.dataverse");

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  };

  const blocked = dv.needsGuestbookForm(preview);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t("title")}</h2>
        <p className="text-sm text-gray-500 mb-6">{t("subtitle")}</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={doi}
            onChange={(e) => onDoiChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder={t("doiPlaceholder")}
            className="h-10 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
          />
          <button
            type="button"
            onClick={onSearch}
            disabled={searching || !doi.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {searching ? t("searching") : t("search")}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {preview && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">{preview.ficha.title as string || preview.doi}</p>
            {preview.citation && <p className="mt-1 text-xs text-gray-500">{preview.citation}</p>}
            {preview.license && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500">
                {preview.license}
                {preview.license_uri && (
                  <a href={preview.license_uri} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </p>
            )}

            {dv.guestbook && !dv.guestbookConfirmed && (
              <div className="mt-3">
                <DataverseGuestbookForm state={dv} />
              </div>
            )}

            <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{t("chooseFile")}</p>
            <div className="space-y-1.5">
              {preview.files.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{f.filename}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                      {formatSize(f.size)}
                      {f.categories?.map((c) => (
                        <span key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                          {c}
                        </span>
                      ))}
                      {f.restricted && (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <Lock className="h-3 w-3" /> {t("restricted")}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDownloadFile(f)}
                    disabled={f.restricted || blocked || dv.downloadingId === f.id}
                    title={blocked ? t("guestbook.required") : undefined}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {dv.downloadingId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {t("downloadOnly")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMapFile(f)}
                    disabled={f.restricted || blocked || mappingFileId !== null}
                    title={blocked ? t("guestbook.required") : undefined}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {mappingFileId === f.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t("useForMapping")}
                  </button>
                </div>
              ))}
            </div>
            {dv.downloadError && <p className="mt-2 text-xs text-red-600">{dv.downloadError}</p>}
          </div>
        )}
      </div>

      {preview && <p className="text-right text-xs text-gray-400">{t("metadataOnlyHint")}</p>}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </button>
        {preview && (
          <button
            type="button"
            onClick={onMetadataOnly}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            {t("metadataOnly")}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Validación ────────────────────────────────────────────────────────


// -- Dataset ficha (FAIR metadata captured during upload) --------------------

/**
 * A brand-new project does not exist until its submission is approved, so the
 * ficha cannot be edited in the catalogue yet - it is captured here and applied
 * to the project on approval. QC fields are deliberately absent: they belong to
 * the reviewing team and the API rejects them from an uploader.
 *
 * One flat list, no section headings: the grouping was FAIR jargon that meant
 * nothing to the people filling this in.
 */
const FICHA_FIELDS = [
  "title", "abstract", "keywords", "authors", "version", "persistent_id", "related_publications",
  "related_datasets", "subject", "language",
  "temporal_coverage_start", "temporal_coverage_end", "spatial_coverage", "spatial_data_type",
  "geographic_bounding_box",
  "expected_matrices", "expected_variables", "sampling_design",
  "access_level", "authorized_users", "embargo_until", "license", "access_conditions",
  "data_source", "funding_information", "provenance", "methodology", "citation", "usage_notes",
  "contact_name", "contact_email", "contact_name_2", "contact_email_2",
];

const FICHA_TEXTAREAS = new Set(["abstract", "spatial_coverage", "sampling_design", "expected_variables", "access_conditions", "provenance", "methodology", "citation", "usage_notes", "funding_information"]);
const FICHA_DATES = new Set(["temporal_coverage_start", "temporal_coverage_end", "embargo_until"]);
/** Comma-separated in the form, sent as arrays. */
const FICHA_LISTS = new Set(["keywords", "expected_matrices", "related_publications", "authors", "related_datasets"]);
/** Derived from the uploaded file; editable, but prefilled so nobody retypes them. */
const FICHA_AUTOFILLED = new Set(["expected_matrices", "expected_variables"]);
/**
 * Ficha fields a Dataverse import prefills — same "don't overwrite a manual
 * edit" rule as FICHA_AUTOFILLED. `keywords` is deliberately absent: it's
 * backed by its own `AgrovocTerm[]` state (see the keywords picker), not a
 * plain ficha string field, so it's merged separately.
 */
const FICHA_DATAVERSE_FILLED = new Set([
  "title", "abstract", "authors", "related_publications", "related_datasets",
  "subject", "language", "data_source", "funding_information", "usage_notes",
  "temporal_coverage_start", "temporal_coverage_end", "geographic_bounding_box",
  "contact_name", "contact_email", "contact_name_2", "contact_email_2",
]);
/** Dataverse's own controlled vocabulary for `subject`, offered as suggestions
 * (the field stores free text, so an imported value outside this list still fits). */
const DATAVERSE_SUBJECTS = [
  "Agricultural Sciences", "Arts and Humanities", "Astronomy and Astrophysics",
  "Business and Management", "Chemistry", "Computer and Information Science",
  "Earth and Environmental Sciences", "Engineering", "Law", "Mathematical Sciences",
  "Medicine, Health and Life Sciences", "Physics", "Social Sciences", "Other",
];
/** Without these a published dataset cannot be found, cited or asked about. */
const FICHA_REQUIRED = ["title", "abstract", "contact_email", "access_level"] as const;

/** Only three levels are used in practice; the API still accepts legacy values. */
const FICHA_ACCESS_LEVELS: AccessLevel[] = ["PUBLIC", "RESTRICTED", "PRIVATE"];
const SPATIAL_DATA_TYPES = ["POINT", "LINE", "POLYGON", "RASTER"];

/**
 * CGIAR Research Centers, for the "source / organization" suggestions. Offered
 * through a datalist rather than a closed select so partner and national
 * institutions can still be typed in.
 */
const CGIAR_CENTERS = [
  "Alliance of Bioversity International and CIAT",
  "AfricaRice",
  "CIFOR-ICRAF",
  "CIMMYT",
  "CIP",
  "ICARDA",
  "ICRISAT",
  "IFPRI",
  "IITA",
  "ILRI",
  "IRRI",
  "IWMI",
  "WorldFish",
];

/** Common data licenses, offered as suggestions (free text is still accepted). */
const LICENSES = ["CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-NC-4.0", "CC-BY-NC-SA-4.0", "ODbL-1.0"];

/** Fields whose input offers a list of suggestions: tell the user how to see it. */
const SUGGESTED_FIELDS = new Set(["data_source", "subject", "license"]);

export type FichaState = Record<string, string>;

/**
 * access_level starts empty on purpose: who may see the data is a decision the
 * uploader has to make, not one to inherit from a default nobody read.
 */
export const EMPTY_FICHA: FichaState = Object.fromEntries(FICHA_FIELDS.map((f) => [f, ""])) as FichaState;

export const fichaMissing = (f: FichaState): string[] =>
  FICHA_REQUIRED.filter((k) => !(f[k] ?? "").trim());

/** Flat string form -> API payload (lists split, blanks nulled). */
export const fichaPayload = (
  f: FichaState,
  authorized: string[],
  keywords: AgrovocTerm[],
) => {
  const out: Record<string, unknown> = {
    // Stored as {label, uri} so an AGROVOC keyword stays machine-resolvable.
    keywords: keywords.length ? keywords : null,
    // Only a RESTRICTED dataset uses an allow-list; sending one for a public
    // dataset would quietly imply a restriction that does not exist.
    authorized_users: f.access_level === "RESTRICTED" && authorized.length ? authorized : null,
  };
  for (const field of FICHA_FIELDS) {
    if (field === "authorized_users" || field === "keywords") continue;
    const raw = (f[field] ?? "").trim();
    if (FICHA_LISTS.has(field)) {
      const list = raw.split(field === "authors" ? "\n" : ",").map((x) => x.trim()).filter(Boolean);
      out[field] = list.length ? list : null;
    } else {
      out[field] = raw === "" ? null : raw;
    }
  }
  return out;
};

/** Searchable people picker backed by the realm directory. */
function AuthorizedUsersPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (emails: string[]) => void;
}) {
  const t = useTranslations("upload.ficha");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<UserOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      userService
        .search(q)
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const add = (email: string) => {
    if (!value.some((e) => e.toLowerCase() === email.toLowerCase())) onChange([...value, email]);
    setQuery("");
    setOptions([]);
  };

  return (
    <div>
      {value.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((email) => (
            <span key={email} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-900">
              {email}
              <button
                type="button"
                onClick={() => onChange(value.filter((e) => e !== email))}
                aria-label={t("removePerson")}
                className="text-brand-700 hover:text-brand-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPeople")}
          className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
        />
        {query.trim().length >= 2 ? (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {searching ? (
              <p className="px-3 py-2 text-xs text-gray-500">...</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500">{t("noPeople")}</p>
            ) : (
              options.map((o) => (
                <button
                  key={o.email}
                  type="button"
                  onClick={() => add(o.email)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="text-gray-800">{o.name || o.email}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {o.email}
                    {o.organization ? " \u00b7 " + o.organization : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Authors are people: suggest the platform's own users (name or email) and still
 * take anyone else typed in. One author per line in the form state — never a
 * comma, because "Ruiz, Ana" is a single author.
 */
function AuthorsPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("upload.ficha");
  const authors = useMemo(() => value.split("\n").map((a) => a.trim()).filter(Boolean), [value]);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<UserOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const q = query.trim();
    setActive(0);
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      userService
        .search(q)
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const q = query.trim();
  const items = [
    ...options.map((o) => ({ key: o.email, text: (o.name || o.email) + (o.organization ? ` (${o.organization})` : ""), detail: o.email, free: false })),
    ...(q ? [{ key: "__free__", text: q, detail: "", free: true }] : []),
  ];

  const add = (name: string) => {
    const n = name.trim();
    if (n && !authors.some((a) => a.toLowerCase() === n.toLowerCase())) onChange([...authors, n].join("\n"));
    setQuery("");
    setOptions([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter takes the highlighted suggestion, or the typed name when there is nothing to pick.
      if (items.length) add(items[Math.min(active, items.length - 1)].text);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  return (
    <div>
      {authors.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {authors.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1.5 text-xs text-brand-900">
              {name}
              <button
                type="button"
                onClick={() => onChange(authors.filter((a) => a !== name).join("\n"))}
                aria-label={t("authors.remove", { name })}
                className="rounded-full p-0.5 text-brand-700 hover:bg-brand-100 hover:text-brand-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("authors.placeholder")}
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="authors-listbox"
          aria-autocomplete="list"
          className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
        />
        {items.length > 0 ? (
          <ul
            id="authors-listbox"
            role="listbox"
            // Mouse-down would blur the input and drop the list before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            {searching && options.length === 0 ? <li className="px-3 py-2 text-xs text-gray-500">…</li> : null}
            {items.map((item, i) => (
              <li key={item.key} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => add(item.text)}
                  onMouseEnter={() => setActive(i)}
                  className={`block w-full px-3 py-2 text-left text-sm ${i === active ? "bg-brand-50" : "hover:bg-gray-50"}`}
                >
                  {item.free ? (
                    <span className="text-gray-700">{t("authors.addFree", { name: item.text })}</span>
                  ) : (
                    <>
                      <span className="text-gray-800">{item.text}</span>
                      <span className="ml-2 text-xs text-gray-500">{item.detail}</span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <span className="mt-1 block text-[11px] text-gray-500">{t("authors.hint")}</span>
    </div>
  );
}

/**
 * Only four fields are required. Everything else is grouped under plain-language
 * headings that stay closed until someone opens them (or until they already hold
 * something, e.g. a Dataverse import or a recovered draft) — a wall of 30 inputs
 * was what stopped first-time uploaders.
 */
const FICHA_ESSENTIAL = ["title", "abstract", "contact_name", "contact_email", "access_level", "authorized_users"];
const FICHA_GROUPS: { key: string; fields: string[] }[] = [
  { key: "authorship", fields: ["authors", "version", "persistent_id", "citation", "related_publications", "related_datasets"] },
  { key: "coverage", fields: ["keywords", "subject", "language", "temporal_coverage_start", "temporal_coverage_end", "spatial_coverage", "spatial_data_type", "geographic_bounding_box"] },
  { key: "content", fields: ["expected_matrices", "expected_variables", "sampling_design"] },
  { key: "reuse", fields: ["license", "embargo_until", "access_conditions", "usage_notes"] },
  { key: "origin", fields: ["data_source", "funding_information", "provenance", "methodology"] },
  { key: "contact2", fields: ["contact_name_2", "contact_email_2"] },
];

function DatasetFicha({
  value,
  onChange,
  authorized,
  onAuthorizedChange,
  keywords,
  onKeywordsChange,
}: {
  value: FichaState;
  onChange: (f: FichaState) => void;
  authorized: string[];
  onAuthorizedChange: (emails: string[]) => void;
  keywords: AgrovocTerm[];
  onKeywordsChange: (terms: AgrovocTerm[]) => void;
}) {
  const t = useTranslations("upload.ficha");
  // Field labels already exist for the dataset catalogue - reuse them so both
  // screens always name the same field the same way.
  const td = useTranslations("datasets");
  const missing = fichaMissing(value);
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isFilled = (field: string) =>
    field === "keywords"
      ? keywords.length > 0
      : field === "authorized_users"
      ? authorized.length > 0
      : (value[field] ?? "").trim() !== "";

  // A group that already holds something opens by itself, once. After that the
  // person's own open/close wins, and a group never closes under the field being typed in.
  const filledSignature = FICHA_GROUPS.map((g) => (g.fields.some(isFilled) ? "1" : "0")).join("");
  useEffect(() => {
    setOpenGroups((prev) => {
      let next = prev;
      for (const g of FICHA_GROUPS) {
        if (!(g.key in next) && g.fields.some(isFilled)) next = { ...next, [g.key]: true };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledSignature]);

  // The allow-list only means something for a RESTRICTED dataset: a public one
  // needs no permissions, and a private one is the owner's alone.
  const isVisible = (field: string) => field !== "authorized_users" || value.access_level === "RESTRICTED";

  const renderField = (field: string) => {
    const wide = FICHA_TEXTAREAS.has(field) || field === "title" || field === "authorized_users" || FICHA_LISTS.has(field);
    const help = t.has(`help.${field}`) ? t(`help.${field}`) : null;
    const placeholder = t.has(`placeholder.${field}`) ? t(`placeholder.${field}`) : "";
    const isRequired = (FICHA_REQUIRED as readonly string[]).includes(field);
    return (
      <label key={field} className={`block ${wide ? "sm:col-span-2" : ""}`}>
        <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-600">
          {td(`fields.${field}`)}
          {isRequired ? (
            <>
              <span className="text-red-500" title={t("required")} aria-label={t("required")}>*</span>
              {!missing.includes(field) ? <Check className="h-3 w-3 text-brand-600" aria-hidden /> : null}
            </>
          ) : null}
          {help ? <FieldHelp text={help} /> : null}
          {FICHA_AUTOFILLED.has(field) && (value[field] ?? "").trim() ? (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-500">
              {t("fromFile")}
            </span>
          ) : null}
        </span>

        {field === "authorized_users" ? (
          <AuthorizedUsersPicker value={authorized} onChange={onAuthorizedChange} />
        ) : field === "keywords" ? (
          <KeywordsPicker value={keywords} onChange={onKeywordsChange} />
        ) : field === "authors" ? (
          <AuthorsPicker value={value.authors ?? ""} onChange={(v) => set("authors", v)} />
        ) : field === "access_level" ? (
          <select
            value={value.access_level ?? ""}
            onChange={(e) => set("access_level", e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm outline-none focus:border-brand-400 focus:bg-white"
          >
            <option value="">{t("choose")}</option>
            {FICHA_ACCESS_LEVELS.map((a) => (
              <option key={a} value={a}>{td(`access.${a}`)}</option>
            ))}
          </select>
        ) : field === "spatial_data_type" ? (
          <select
            value={value.spatial_data_type ?? ""}
            onChange={(e) => set("spatial_data_type", e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm outline-none focus:border-brand-400 focus:bg-white"
          >
            <option value="">{t("choose")}</option>
            {SPATIAL_DATA_TYPES.map((g) => (
              <option key={g} value={g}>{t(`spatialTypes.${g}`)}</option>
            ))}
          </select>
        ) : field === "data_source" ? (
          <>
            <input
              list="cgiar-centers"
              value={value.data_source ?? ""}
              onChange={(e) => set("data_source", e.target.value)}
              placeholder={placeholder}
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
            />
            <datalist id="cgiar-centers">
              {CGIAR_CENTERS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        ) : field === "license" ? (
          <>
            <input
              list="data-licenses"
              value={value.license ?? ""}
              onChange={(e) => set("license", e.target.value)}
              placeholder={placeholder}
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
            />
            <datalist id="data-licenses">
              {LICENSES.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </>
        ) : field === "subject" ? (
          <>
            <input
              list="dataverse-subjects"
              value={value.subject ?? ""}
              onChange={(e) => set("subject", e.target.value)}
              placeholder={placeholder}
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
            />
            <datalist id="dataverse-subjects">
              {DATAVERSE_SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </>
        ) : FICHA_TEXTAREAS.has(field) ? (
          <textarea
            value={value[field] ?? ""}
            onChange={(e) => set(field, e.target.value)}
            rows={field === "abstract" ? 3 : 2}
            placeholder={placeholder}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white"
          />
        ) : (
          <input
            type={FICHA_DATES.has(field) ? "date" : field === "contact_email" || field === "contact_email_2" ? "email" : "text"}
            value={value[field] ?? ""}
            onChange={(e) => set(field, e.target.value)}
            placeholder={placeholder}
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
          />
        )}

        {SUGGESTED_FIELDS.has(field) ? (
          <span className="mt-0.5 block text-[10px] text-gray-400">{t("suggestionsHint")}</span>
        ) : null}

        {FICHA_LISTS.has(field) && field !== "keywords" && field !== "authors" ? (
          <span className="mt-0.5 block text-[10px] text-gray-400">{td("fields.listHint")}</span>
        ) : null}
      </label>
    );
  };

  const requiredDone = FICHA_REQUIRED.length - missing.length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-xl">
            <h3 className="text-base font-semibold text-gray-900">{t("essentialTitle")}</h3>
            <p className="mt-0.5 text-sm text-gray-500">{t("essentialSubtitle")}</p>
          </div>
          <div className="w-full sm:w-48">
            <p className="text-xs font-medium text-gray-600">{t("requiredProgress", { done: requiredDone, total: FICHA_REQUIRED.length })}</p>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={FICHA_REQUIRED.length}
              aria-valuenow={requiredDone}
            >
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(requiredDone / FICHA_REQUIRED.length) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{FICHA_ESSENTIAL.filter(isVisible).map(renderField)}</div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-gray-900">{t("optionalTitle")}</h3>
        <p className="mt-0.5 text-sm text-gray-500">{t("optionalSubtitle")}</p>
        <div className="mt-3 space-y-3">
          {FICHA_GROUPS.map((group) => {
            const fields = group.fields.filter(isVisible);
            const filled = fields.filter(isFilled).length;
            const open = openGroups[group.key] ?? false;
            return (
              <div key={group.key} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenGroups((s) => ({ ...s, [group.key]: !open }))}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">{t(`groups.${group.key}.title`)}</h4>
                    <p className="text-xs text-gray-500">{t(`groups.${group.key}.description`)}</p>
                  </div>
                  <span className={`shrink-0 text-xs ${filled > 0 ? "font-medium text-brand-700" : "text-gray-400"}`}>
                    {t("filledCount", { filled, total: fields.length })}
                  </span>
                </button>
                {open ? <div className="grid gap-4 border-t border-gray-100 p-5 sm:grid-cols-2">{fields.map(renderField)}</div> : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

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
  const t = useTranslations("upload.validation");
  const hasErrors = result.error_count > 0;
  const hasWarnings = result.warning_count > 0;

  // The API returns messages in one fixed language; the app is bilingual. Resolve
  // the text from the issue's stable `code` (with a per-column variant where the
  // advice differs, e.g. latitude vs a lab value) and fall back to the API text
  // only for codes we have not translated.
  const issueText = useCallback(
    (code: string | null | undefined, column: string | null | undefined, fallback: string) => {
      if (code && column && t.has(`issues.${code}_${column}`)) return t(`issues.${code}_${column}`);
      if (code && t.has(`issues.${code}`)) return t(`issues.${code}`);
      return fallback;
    },
    [t],
  );

  // Same problem in 500 rows is one finding, not 500. Group by column + message,
  // keep a sample value and the first row numbers so the user can go find them.
  const issueGroups = useMemo(() => {
    const map = new Map<string, {
      key: string; column?: string | null; message: string;
      severity: string; count: number; rows: number[]; sampleValue?: string | null; sheet?: string | null;
    }>();
    for (const issue of result.issues) {
      const key = `${issue.severity}|${issue.column ?? ""}|${issue.code ?? issue.message}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (existing.rows.length < 6) existing.rows.push(issue.row);
      } else {
        map.set(key, {
          key,
          column: issue.column,
          message: issueText(issue.code, issue.column, issue.message),
          severity: issue.severity,
          count: 1,
          rows: [issue.row],
          sampleValue: issue.value,
          sheet: issue.sheet,
        });
      }
    }
    // Errors first: they are what blocks the upload.
    return [...map.values()].sort(
      (a, b) => (a.severity === b.severity ? b.count - a.count : a.severity === "error" ? -1 : 1),
    );
  }, [result.issues, issueText]);

  if (importResult) {
    const inserted = importResult.inserted;
    // Nothing is published yet: the upload is staged until a reviewer approves it,
    // so this is an amber "under review" state, not a green "done" one.
    const pendingReview = importResult.status === "pending_review";
    return (
      <div className="space-y-6">
        <div className={`rounded-2xl border p-6 shadow-sm ${pendingReview ? "border-amber-200 bg-amber-50" : "border-brand-200 bg-brand-50"}`}>
          <div className="flex items-start gap-3">
            {pendingReview ? (
              <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
            ) : (
              <CheckCircle className="h-5 w-5 text-brand-700 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-semibold ${pendingReview ? "text-amber-700" : "text-brand-800"}`}>
                {importResult.message ?? (pendingReview ? t("submittedForReview") : t("importDone"))}
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                {pendingReview
                  ? t("reviewPending")
                  : importResult.skipped_rows > 0
                    ? t("skippedRows", { count: importResult.skipped_rows })
                    : t("allImported")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            {pendingReview ? t("recordsToPublish") : t("insertedRecords")}
          </h3>
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
      <div className={`rounded-2xl border p-6 shadow-sm ${hasErrors ? "border-red-200 bg-red-50" : hasWarnings ? "border-yellow-200 bg-yellow-50" : "border-brand-200 bg-brand-50"}`}>
        <div className="flex items-start gap-3">
          {hasErrors ? (
            <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
          ) : hasWarnings ? (
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
          ) : (
            <CheckCircle className="h-5 w-5 text-brand-700 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-semibold ${hasErrors ? "text-red-700" : hasWarnings ? "text-yellow-700" : "text-brand-800"}`}>
              {hasErrors
                ? t("errorsFound")
                : hasWarnings
                ? t("validWithWarnings")
                : t("validReady")}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              {t("rowsSummary", { valid: result.valid_rows, total: result.total_rows })}
              {result.error_count > 0 && t("errorsSuffix", { count: result.error_count })}
              {result.warning_count > 0 && t("warningsSuffix", { count: result.warning_count })}
            </p>
          </div>
        </div>
      </div>

      {/* Affected entities preview */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-4">{t("wouldCreate")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Object.entries(result.summary).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, " ")}</p>
              <p className="text-lg font-semibold text-gray-900">{value ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Issues, grouped: one row per problem type, not per cell. A 500-row file
          with one bad column produced 500 identical lines, which nobody reads. */}
      {issueGroups.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">{t("issuesDetail")}</h3>
            <p className="mt-0.5 text-sm text-gray-500">{t("issuesGroupedHint")}</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {issueGroups.map((g) => (
              <li key={g.key} className="px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      g.severity === "error" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {g.severity === "error" ? t("error") : t("warning")}
                  </span>
                  <span className="font-mono text-sm text-gray-800">{g.column ?? "—"}</span>
                  {/* Only data rows count as "affected": a problem with a column, the file
                      or another sheet is not a number of rows. */}
                  {!g.sheet && g.rows[0] > 0 ? (
                    <span className="text-sm text-gray-500">
                      {t("affectedRows", { count: g.count })}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1.5 max-w-3xl text-sm text-gray-700">{g.message}</p>

                {g.sheet || g.rows[0] <= 0 ? (
                  // Not a data row: name the sheet and row it lives in (if any), plus the
                  // offending value (if any) — never "Row 0".
                  g.sheet || g.sampleValue ? (
                    <p className="mt-1.5 text-xs text-gray-500">
                      {g.sheet ? t("inSheet", { sheet: g.sheet, row: g.rows[0] }) : null}
                      {g.sheet && g.sampleValue ? " · " : null}
                      {g.sampleValue ? (
                        <>
                          {t("valueLabel")}: <span className="font-mono text-gray-700">{g.sampleValue}</span>
                        </>
                      ) : null}
                    </p>
                  ) : null
                ) : (
                  <p className="mt-1.5 text-xs text-gray-500">
                    {t("exampleValue")}: <span className="font-mono text-gray-700">{g.sampleValue ?? "—"}</span>
                    {" · "}
                    {t("colRow")} {g.rows.slice(0, 6).join(", ")}
                    {g.rows.length > 6 ? ` … (+${g.count - 6})` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {importError && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {importError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {t("backToUpload")}
        </button>
        <button
          disabled={hasErrors || importing}
          onClick={onImport}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing ? t("importing") : t("importData")}
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
  const t = useTranslations("upload.newVariable");
  const tv = useTranslations("upload.valueTypes");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const [valueType, setValueType] = useState("numeric");
  const [matrix, setMatrix] = useState("");
  const [unitId, setUnitId] = useState("");
  const [domain, setDomain] = useState("");
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
      setError(t("nameRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const variable = await variablesService.create({
        variable_code: finalCode,
        name: name.trim(),
        domain: domain.trim() || "CUSTOM",
        value_type: valueType,
        matrix: matrix || null,
        default_unit_id: unitId ? Number(unitId) : null,
      });
      onCreated(variable.id, variable.name ?? "");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : t("createError"),
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
            <h3 className="text-lg font-semibold text-gray-900">{t("title")}</h3>
            <p className="text-sm text-gray-500">{t("subtitle")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("name")}</label>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("code")}</label>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeEdited(true);
              }}
              placeholder="BORO_DISPONIBLE"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-400">{t("codeHint")}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("valueType")}</label>
              <select
                value={valueType}
                onChange={(e) => setValueType(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {VALUE_TYPE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {tv(key)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("matrix")}</label>
              <select
                value={matrix}
                onChange={(e) => setMatrix(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("unit")}</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">—</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t("domain")}</label>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                list="variable-domains"
                placeholder="CUSTOM"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <datalist id="variable-domains">
                {domains.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-400">{t("domainHint")}</p>

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
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t("creating") : t("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type UploadMode = "archivo" | "manual" | "glosario";

const UPLOAD_DRAFT_KEY = "mfl_upload_draft_v1";

export default function UploadView({ canManageCatalog }: { canManageCatalog: boolean }) {
  const t = useTranslations("upload");
  const locale = useLocale();
  const [mode, setMode] = useState<UploadMode>("archivo");
  const [step, setStep] = useState<Step>("metadata");

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

  // Step 2b — mapping columns of a file that doesn't use our headers
  const [ownHeaders, setOwnHeaders] = useState(false);
  const [headerRow, setHeaderRow] = useState(1);
  const [parsingFile, setParsingFile] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileColumns, setFileColumns] = useState<FileColumn[]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  // Tracks which file the current fileColumns/mapping belong to, so picking a
  // genuinely different file resets the mapping instead of keeping stale rows.
  const [parsedFileKey, setParsedFileKey] = useState<string | null>(null);
  // Where the current `file` came from, so "back" from the mapping step returns
  // to the right place (a local pick has no Dataverse search to go back to).
  const [fileSource, setFileSource] = useState<"local" | "dataverse">("local");

  // Step 2c — importing a dataset from Dataverse by DOI
  const [dataverseDoi, setDataverseDoi] = useState("");
  const [dataverseSearching, setDataverseSearching] = useState(false);
  const [dataverseError, setDataverseError] = useState<string | null>(null);
  const [dataversePreview, setDataversePreview] = useState<DataversePreviewResponse | null>(null);
  // Which file is currently being downloaded-and-mapped (not download-to-disk,
  // that's tracked by `dv.downloadingId`); null when none is in flight.
  const [mappingFileId, setMappingFileId] = useState<number | null>(null);
  // Guestbook state + the actual download call — shared with the standalone
  // Dataverse browser (see useDataverseDownload.ts). No token input here yet:
  // this wizard step has never supported restricted (token-gated) datasets.
  const dv = useDataverseDownload();

  // Step 3 — import
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<UploadImportResponse | null>(null);
  // Ficha FAIR del dataset, capturada aquí porque un proyecto nuevo no existe
  // en el catálogo hasta que la submission se aprueba.
  const [ficha, setFicha] = useState<FichaState>(EMPTY_FICHA);
  const [authorized, setAuthorized] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<AgrovocTerm[]>([]);
  const [suggestedCols, setSuggestedCols] = useState<Set<number>>(new Set());

  // Protect the person's work: the ficha is the longest thing they type here and a
  // reload, a lost connection or an expired session must not cost them all of it.
  // Kept in this browser only; cleared once the upload has been sent.
  const [draftRestored, setDraftRestored] = useState(false);
  const draftLoaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UPLOAD_DRAFT_KEY);
      const draft = raw ? JSON.parse(raw) : null;
      if (draft && typeof draft.ficha === "object" && draft.ficha) {
        setFicha({ ...EMPTY_FICHA, ...draft.ficha });
        setAuthorized(Array.isArray(draft.authorized) ? draft.authorized : []);
        setKeywords(Array.isArray(draft.keywords) ? draft.keywords : []);
        setDraftRestored(true);
      }
    } catch {
      /* storage blocked or the draft is corrupt: start empty */
    }
    draftLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!draftLoaded.current || importResult) return;
    const empty = Object.values(ficha).every((v) => !v.trim()) && authorized.length === 0 && keywords.length === 0;
    const timer = setTimeout(() => {
      try {
        if (empty) localStorage.removeItem(UPLOAD_DRAFT_KEY);
        else localStorage.setItem(UPLOAD_DRAFT_KEY, JSON.stringify({ ficha, authorized, keywords }));
      } catch {
        /* a per-browser convenience: fine if it does not stick */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [ficha, authorized, keywords, importResult]);

  const discardDraft = () => {
    setFicha(EMPTY_FICHA);
    setAuthorized([]);
    setKeywords([]);
    setDraftRestored(false);
    try {
      localStorage.removeItem(UPLOAD_DRAFT_KEY);
    } catch {
      /* nothing to clear */
    }
  };

  // The spreadsheet already states which matrices and variables it carries, so
  // prefill them instead of asking the user to retype what we just parsed. Only
  // fills empty fields, so an edit made by hand is never overwritten.
  useEffect(() => {
    if (!validation) return;
    const matrices = validation.detected_matrices ?? [];
    const variables = validation.detected_variables ?? [];
    if (!matrices.length && !variables.length) return;
    setFicha((prev) => ({
      ...prev,
      expected_matrices: prev.expected_matrices?.trim() ? prev.expected_matrices : matrices.join(", "),
      expected_variables: prev.expected_variables?.trim() ? prev.expected_variables : variables.join(", "),
    }));
  }, [validation]);

  // Each step is a different screen: start it at the top instead of wherever the last one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

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
        err instanceof Error ? err.message : t("errors.columnsLoad"),
      );
    } finally {
      setLoadingColumns(false);
    }
  }, [t]);

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
    }, locale);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    setValidateError(null);
    try {
      const result = await uploadService.validate(file, { columns: Array.from(selected), headerRow });
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
          : t("errors.validate");
      setValidateError(message);
    } finally {
      setValidating(false);
    }
  };

  const handleOwnHeaders = () => {
    setOwnHeaders(true);
    setStep("cargar");
  };

  const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

  /**
   * "Continue" from the metadata step. A full Dataverse import already picked
   * and parsed a file before looping back here for ficha review — in that case
   * skip template/upload entirely and go straight to mapping; otherwise this is
   * the normal manual path, so go choose a template/file next.
   */
  const handleMetadataContinue = () => {
    if (file && validation) {
      // Came back (through the step bar) just to fix the ficha: the file is already validated.
      setStep("validacion");
    } else if (file && fileColumns.length > 0 && parsedFileKey === fileKey(file)) {
      setStep("mapear");
    } else {
      setStep("plantilla");
    }
  };

  const handleFileSelected = (f: File, source: "local" | "dataverse" = "local") => {
    setFile(f);
    setFileSource(source);
    // A genuinely different file invalidates any mapping (and validation) built for the old one.
    if (parsedFileKey !== fileKey(f)) {
      setValidation(null);
      setSuggestedCols(new Set());
      setFileColumns([]);
      setMapping({});
      setParsedFileKey(null);
      setParseError(null);
    }
  };

  /** Reads just the header row (+ one preview row) of a file, client-side. Shared
   * by both the local-file mapping flow and the Dataverse import flow below. */
  const parseFileToColumns = async (f: File): Promise<FileColumn[]> => {
    const XLSX = await import("xlsx");
    const buffer = await f.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", sheetRows: 20 });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true, defval: "" });
    const headerIdx = Math.max(0, headerRow - 1);
    const headerValues = rows[headerIdx];
    if (!headerValues || headerValues.every((c) => c === "" || c == null)) {
      throw new Error(t("errors.noColumnsDetected"));
    }
    const previewValues = rows[headerIdx + 1] ?? [];
    const columns: FileColumn[] = headerValues
      .map((raw, index) => ({
        index,
        header: raw == null ? "" : String(raw).trim(),
        example: previewValues[index] == null ? "" : String(previewValues[index]).trim(),
      }))
      .filter((col) => col.header !== "" || col.example !== "");
    if (columns.length === 0) {
      throw new Error(t("errors.noColumnsDetected"));
    }
    return columns;
  };

  const handleContinueToMapping = async () => {
    if (!file) return;
    const key = fileKey(file);
    if (parsedFileKey === key && fileColumns.length > 0) {
      setStep("mapear");
      return;
    }
    setParsingFile(true);
    setParseError(null);
    try {
      const columns = await parseFileToColumns(file);
      setFileColumns(columns);
      applySuggestions(columns);
      setParsedFileKey(key);
      setStep("mapear");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t("errors.parseFile"));
    } finally {
      setParsingFile(false);
    }
  };

  /** Starts the mapping from what can be matched by name, so only the rest is left to the person. */
  const applySuggestions = (columns: FileColumn[]) => {
    const labelOf = (c: TemplateColumn) => (t.has(`columnLabels.${c.id}`) ? t(`columnLabels.${c.id}`) : c.label);
    const suggestions = suggestMapping(columns, allColumns, labelOf);
    setMapping(suggestions);
    setSuggestedCols(new Set(Object.keys(suggestions).map(Number)));
  };

  const handleMappingChange = (index: number, targetId: string) => {
    setMapping((prev) => ({ ...prev, [index]: targetId }));
    // Once the person has chosen, it is their choice, not our suggestion.
    setSuggestedCols((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const handleValidateMapping = async () => {
    if (!file) return;
    setValidating(true);
    setValidateError(null);
    try {
      const columnMapping: ColumnMappingEntry[] = fileColumns.map((col) => ({
        source_index: col.index,
        source_header: col.header || null,
        target_id: mapping[col.index] || null,
      }));
      const result = await uploadService.validate(file, { columnMapping, headerRow });
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
          : t("errors.validate");
      setValidateError(message);
    } finally {
      setValidating(false);
    }
  };

  const handleImportDataverse = () => {
    setStep("dataverse");
  };

  const handleDataverseSearch = async () => {
    const doi = dataverseDoi.trim();
    if (!doi) return;
    setDataverseSearching(true);
    setDataverseError(null);
    setDataversePreview(null);
    try {
      const result = await dataverseService.preview(doi);
      setDataversePreview(result);
      await dv.loadForPreview(result);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : t("errors.dataverseFetch");
      setDataverseError(message);
    } finally {
      setDataverseSearching(false);
    }
  };

  /** Prefills the ficha from the Dataverse metadata — only into fields not already
   * filled by hand (same rule as the spreadsheet-detected matrices/variables). */
  const applyDataverseFicha = (dvFicha: Record<string, unknown>) => {
    setFicha((prev) => {
      const next = { ...prev };
      for (const field of FICHA_DATAVERSE_FILLED) {
        if ((prev[field] ?? "").trim()) continue; // never overwrite a manual edit
        const raw = dvFicha[field];
        if (raw === null || raw === undefined) continue;
        next[field] = Array.isArray(raw) ? raw.join(field === "authors" ? "\n" : ", ") : String(raw);
      }
      return next;
    });
    const dvKeywords = dvFicha.keywords;
    if (keywords.length === 0 && Array.isArray(dvKeywords) && dvKeywords.length) {
      setKeywords((dvKeywords as unknown[]).map((label) => ({ label: String(label), uri: null })));
    }
  };

  /**
   * Some datasets can't be downloaded here at all (e.g. a Dataverse Guestbook
   * requirement — see services/dataverse.py) — the metadata endpoint doesn't hit
   * that wall, so a person can still prefill the ficha and bring their own copy
   * of the file (downloaded by hand from Dataverse, or any other file) through
   * the normal upload step.
   */
  const handleDataverseMetadataOnly = () => {
    if (!dataversePreview) return;
    applyDataverseFicha(dataversePreview.ficha);
    setDataverseError(null);
    setStep("metadata");
  };

  /** Download a Dataverse file straight to the user's computer — no mapping,
   * no ficha prefill, stays on this step so they can keep browsing/downloading. */
  const handleDataverseDownloadFile = async (file: DataverseFileInfo) => {
    const result = await dv.downloadFile(file);
    if (result) saveBlob(result.blob, result.filename);
  };

  /**
   * Downloads the chosen file through our proxy (via the shared Guestbook-aware
   * download call), turns it into a real `File`, prefills the ficha, and parses
   * its columns (an imported file never carries our hidden id row, so it always
   * needs mapping) — then returns to the metadata step so the person can review
   * what got prefilled before moving on; `handleMetadataContinue` detects the
   * file is already there and skips straight to mapping from there.
   */
  const handleDataverseMapFile = async (file: DataverseFileInfo) => {
    if (!dataversePreview) return;
    setMappingFileId(file.id);
    setDataverseError(null);
    try {
      const result = await dv.downloadFile(file);
      if (!result) return; // dv.downloadError already carries the reason
      const constructedFile = new File([result.blob], result.filename || file.filename, {
        type: file.content_type || result.blob.type,
      });

      applyDataverseFicha(dataversePreview.ficha);

      setOwnHeaders(true);
      handleFileSelected(constructedFile, "dataverse");
      const columns = await parseFileToColumns(constructedFile);
      setFileColumns(columns);
      applySuggestions(columns);
      setParsedFileKey(fileKey(constructedFile));
      setStep("metadata");
    } catch (err) {
      setDataverseError(err instanceof Error ? err.message : t("errors.dataverseFileDownload"));
    } finally {
      setMappingFileId(null);
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
        metadata: fichaPayload(ficha, authorized, keywords),
      });
      setImportResult(result);
      try {
        localStorage.removeItem(UPLOAD_DRAFT_KEY);
      } catch {
        /* nothing to clear */
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : t("errors.import");
      setImportError(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t("header.title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("header.subtitle")}</p>
      </div>

      {/* Mode switch: file import vs manual registration */}
      <div className="mb-6 flex w-fit flex-wrap gap-1 rounded-full border border-gray-200 bg-gray-50 p-1">
        {([
          { key: "archivo" as UploadMode, label: t("modes.file") },
          { key: "manual" as UploadMode, label: t("modes.manual") },
          { key: "glosario" as UploadMode, label: t("modes.glossary") },
        ]).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setMode(item.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === item.key ? "bg-brand-700 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === "glosario" ? (
        <ColumnGlossary />
      ) : mode === "manual" ? (
        <ManualRegistration canManageCatalog={canManageCatalog} />
      ) : (
        <>
          {/* Steps */}
          <div className="mb-6">
            <StepIndicator current={step} finished={importResult !== null} onNavigate={setStep} />
          </div>

          {/* Content */}
          {step === "metadata" && (
            <StepMetadata
              ficha={ficha}
              onFichaChange={setFicha}
              authorized={authorized}
              onAuthorizedChange={setAuthorized}
              keywords={keywords}
              onKeywordsChange={setKeywords}
              onImportDataverse={handleImportDataverse}
              onContinue={handleMetadataContinue}
              draftRestored={draftRestored}
              onDiscardDraft={discardDraft}
            />
          )}
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
              onOwnHeaders={handleOwnHeaders}
              onNewVariable={() => setShowNewVariable(true)}
              canManageCatalog={canManageCatalog}
              allSelected={allSelected}
              onToggleAll={handleToggleAll}
            />
          )}
          {step === "cargar" && (
            <StepCargar
              file={file}
              onFile={handleFileSelected}
              ownHeaders={ownHeaders}
              onToggleOwnHeaders={setOwnHeaders}
              headerRow={headerRow}
              onHeaderRowChange={setHeaderRow}
              onValidate={handleValidate}
              onContinueToMapping={handleContinueToMapping}
              validating={validating}
              parsing={parsingFile}
              parseError={parseError}
              error={validateError}
            />
          )}
          {step === "mapear" && (
            <StepMapear
              groups={groups}
              allColumns={allColumns}
              fileColumns={fileColumns}
              mapping={mapping}
              onMappingChange={handleMappingChange}
              suggested={suggestedCols}
              onBack={() => setStep(fileSource === "dataverse" ? "dataverse" : "cargar")}
              onContinue={handleValidateMapping}
              validating={validating}
              error={validateError}
            />
          )}
          {step === "dataverse" && (
            <StepDataverse
              doi={dataverseDoi}
              onDoiChange={setDataverseDoi}
              onSearch={handleDataverseSearch}
              searching={dataverseSearching}
              error={dataverseError}
              preview={dataversePreview}
              dv={dv}
              onBack={() => setStep("metadata")}
              onDownloadFile={handleDataverseDownloadFile}
              onMapFile={handleDataverseMapFile}
              onMetadataOnly={handleDataverseMetadataOnly}
              mappingFileId={mappingFileId}
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

          {canManageCatalog && showNewVariable && (
            <NewVariableModal
              onClose={() => setShowNewVariable(false)}
              onCreated={handleVariableCreated}
            />
          )}
        </>
      )}
    </div>
  );
}
