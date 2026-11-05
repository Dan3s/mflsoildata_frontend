"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Search, X, Loader2, Database, ShieldCheck, Pencil, Check, Globe, Tag, Landmark, Layers, ArrowRight, Map as MapIcon, BarChart3, Download as DownloadIcon, Lock, FileSpreadsheet } from "lucide-react";
import { ApiError, dashboardService, datasetService, downloadService } from "@/app/services";
import KeywordsPicker, { keywordLabels, toTerms } from "./KeywordsPicker";
import MatrixBadge from "./MatrixBadge";
import { yearMatches } from "./datasetYear";
import type {
  AgrovocTerm,
  AccessLevel,
  DatasetCatalogueItem,
  ProjectMetadata,
  ProjectMetadataUpsert,
  QcStatus,
} from "@/app/services";
import type { DashboardFilterValues } from "./DashboardFilters";

/** Offered when editing. The team settled on three levels. */
const ACCESS_LEVELS: AccessLevel[] = ["PUBLIC", "RESTRICTED", "PRIVATE"];
const QC_STATUSES: QcStatus[] = ["NOT_REVIEWED", "IN_REVIEW", "PASSED", "FAILED"];

const ACCESS_BADGE: Record<AccessLevel, string> = {
  PUBLIC: "bg-brand-100 text-brand-800",
  RESTRICTED: "bg-amber-100 text-amber-700",
  PRIVATE: "bg-gray-200 text-gray-700",
  EMBARGOED: "bg-orange-100 text-orange-700",
  LICENSED: "bg-blue-100 text-blue-700",
  CONFIDENTIAL: "bg-red-100 text-red-700",
};
const QC_BADGE: Record<QcStatus, string> = {
  NOT_REVIEWED: "bg-gray-100 text-gray-500",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  PASSED: "bg-brand-100 text-brand-800",
  FAILED: "bg-red-100 text-red-700",
};

type SortKey = "recent" | "oldest" | "az" | "za";

const yearOf = (item: DatasetCatalogueItem): string => {
  const start = item.temporal_coverage_start?.slice(0, 4);
  const end = item.temporal_coverage_end?.slice(0, 4);
  if (start && end && start !== end) return `${start}–${end}`;
  if (start) return start;
  if (item.updated_at) return item.updated_at.slice(0, 4);
  return "";
};

// -- Dataset row ------------------------------------------------------------

/** Palette for the row thumbnails — the app's greens plus a warm counterweight. */
const THUMB_PALETTES = [
  ["#0f4c5c", "#3d8a8f", "#c98b28", "#5aa9a3"],
  ["#14532d", "#3f8f5e", "#c2762a", "#7bbf95"],
  ["#155e63", "#2f8f8a", "#b8722c", "#63b3a6"],
  ["#1b4332", "#40916c", "#bc6c25", "#74c69d"],
];

/** Stable small integer from the dataset code, so a dataset always looks the same. */
const hashCode = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/**
 * Decorative thumbnail. The catalogue has no images, and an empty grey box would
 * be worse than nothing, so each row gets a deterministic abstract mark: same
 * dataset, same shapes, and enough variation to tell rows apart while scrolling.
 */
function DatasetThumb({ code }: { code: string }) {
  const h = hashCode(code);
  const palette = THUMB_PALETTES[h % THUMB_PALETTES.length];
  const blobs = [0, 1, 2].map((i) => {
    const seed = h >> (i * 3);
    return {
      cx: 20 + ((seed >> 2) % 70),
      cy: 20 + ((seed >> 5) % 60),
      rx: 18 + ((seed >> 7) % 26),
      ry: 16 + ((seed >> 4) % 24),
      fill: palette[(i + 1) % palette.length],
      rot: (seed % 90) - 45,
    };
  });

  return (
    <svg
      viewBox="0 0 110 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className="h-full w-full"
    >
      <rect width="110" height="100" fill={palette[0]} />
      {blobs.map((b, i) => (
        <ellipse
          key={i}
          cx={b.cx}
          cy={b.cy}
          rx={b.rx}
          ry={b.ry}
          fill={b.fill}
          opacity={0.55}
          transform={`rotate(${b.rot} ${b.cx} ${b.cy})`}
        />
      ))}
      <path d="M0 72 Q 30 62 55 72 T 110 70" stroke="#ffffff" strokeOpacity="0.18" fill="none" strokeWidth="1.5" />
      <path d="M0 84 Q 30 74 55 84 T 110 82" stroke="#ffffff" strokeOpacity="0.12" fill="none" strokeWidth="1.5" />
    </svg>
  );
}

/** Marks where the search text matched, so the person can see why a card is in the results. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-amber-100 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * From a dataset to its data: the same project, already chosen, on the map, in the
 * chart explorer or in the download. Each one is a plain link (so it can be opened
 * in a new tab). Without access to the data they are shown disabled, with the reason.
 */
function ExploreLinks({ projectId, accessible, size = "sm" }: { projectId: number; accessible: boolean; size?: "sm" | "md" }) {
  const t = useTranslations("datasets.actions");
  const items = [
    { key: "map", href: `/dashboard/map?project_id=${projectId}`, icon: <MapIcon className="h-3.5 w-3.5" />, label: t("map") },
    { key: "chart", href: `/dashboard/visualization?project_id=${projectId}`, icon: <BarChart3 className="h-3.5 w-3.5" />, label: t("chart") },
    { key: "download", href: `/dashboard/download?project_id=${projectId}`, icon: <DownloadIcon className="h-3.5 w-3.5" />, label: t("download") },
  ];
  const base =
    size === "md"
      ? "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition"
      : "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition";

  return (
    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {items.map((item) =>
        accessible ? (
          <Link
            key={item.key}
            href={item.href}
            className={`${base} border-brand-200 bg-white text-brand-800 hover:border-brand-400 hover:bg-brand-50`}
          >
            {item.icon}
            {item.label}
          </Link>
        ) : (
          <span key={item.key} aria-disabled="true" title={t("noAccess")} className={`${base} cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400`}>
            {item.icon}
            {item.label}
          </span>
        ),
      )}
      {accessible ? null : <Lock className="h-3.5 w-3.5 text-gray-400" aria-label={t("noAccess")} />}
    </div>
  );
}

function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-gray-500">
      <span className="shrink-0 text-gray-400">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * One dataset per card. The identifying facts sit on a single line so the list
 * can be scanned and compared; the action is pinned to its own column on the
 * right, aligned down the whole list.
 */
function DatasetRow({ item, onOpen, query, accessible }: { item: DatasetCatalogueItem; onOpen: () => void; query: string; accessible: boolean }) {
  const t = useTranslations("datasets");
  const year = yearOf(item);
  const keywords = keywordLabels(item.keywords);
  const matrices = Array.isArray(item.expected_matrices) ? (item.expected_matrices as string[]) : [];

  return (
    // The whole card is a mouse target (a 900px-wide row whose only hit area is a small
    // button is needlessly hard to use). Keyboard and screen-reader users get real
    // controls instead: "View metadata" is a button and the explore actions are links,
    // none of them nested inside another interactive element.
    <article
      onClick={onOpen}
      className="group flex cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-brand-200 hover:shadow-md"
    >
      <div className="hidden w-40 shrink-0 sm:block" aria-hidden>
        <DatasetThumb code={item.code} />
      </div>

      <div className="min-w-0 flex-1 px-5 py-4">
        <h3 className="text-lg font-semibold text-gray-900">
          <Highlight text={item.title || item.name} query={query} />
        </h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {item.qc_status && item.qc_status !== "NOT_REVIEWED" ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${QC_BADGE[item.qc_status]}`}>
              <ShieldCheck className="h-3 w-3" />
              {t(`qcStatus.${item.qc_status}`)}
            </span>
          ) : null}
          {item.access_level ? (
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCESS_BADGE[item.access_level]}`}>
              {t(`access.${item.access_level}`)}
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-400">
              {t("noMetadataTag")}
            </span>
          )}
          {matrices.slice(0, 2).map((m) => (
            <MatrixBadge key={m} value={m} />
          ))}
          {year ? (
            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium tabular-nums text-gray-600">
              {year}
            </span>
          ) : null}
        </div>

        {item.abstract ? (
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-gray-600">
            <Highlight text={item.abstract} query={query} />
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          {item.countries.length ? (
            <MetaItem icon={<Globe className="h-3.5 w-3.5" />}>{item.countries.join(", ")}</MetaItem>
          ) : null}
          {keywords.length ? (
            <MetaItem icon={<Tag className="h-3.5 w-3.5" />}>{keywords.slice(0, 3).join(", ")}</MetaItem>
          ) : null}
          {item.data_source ? (
            <MetaItem icon={<Landmark className="h-3.5 w-3.5" />}>
              <Highlight text={item.data_source} query={query} />
            </MetaItem>
          ) : null}
          <MetaItem icon={<Layers className="h-3.5 w-3.5" />}>
            <span className="font-mono">{item.code}</span>
          </MetaItem>
        </div>

        <div className="mt-3 border-t border-gray-100 pt-3">
          <ExploreLinks projectId={item.project_id} accessible={accessible} />
        </div>
      </div>

      <div className="flex shrink-0 items-center border-l border-gray-100 px-5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          {t("viewDetails")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

// ── Detail / edit modal ───────────────────────────────────────────────────────

const CSV_FIELDS = new Set(["expected_matrices", "authorized_users", "related_publications"]);

/** Filled by the reviewing team only. The API returns 403 if a plain editor sends them. */
const QC_FIELDS = new Set(["quality_controlled", "qc_status", "qc_date", "qc_by", "qc_notes", "data_last_updated"]);

const READ_SECTIONS: { key: string; fields: string[] }[] = [
  { key: "findable", fields: ["title", "abstract", "version", "persistent_id", "keywords", "related_publications"] },
  { key: "coverage", fields: ["temporal_coverage_start", "temporal_coverage_end", "spatial_coverage", "spatial_data_type", "expected_matrices", "expected_variables", "sampling_design"] },
  { key: "access", fields: ["access_level", "authorized_users", "embargo_until", "license", "access_conditions"] },
  { key: "reuse", fields: ["data_source", "provenance", "methodology", "citation", "usage_notes", "contact_name", "contact_email", "contact_name_2", "contact_email_2"] },
  { key: "qc", fields: ["quality_controlled", "qc_status", "qc_date", "qc_by", "qc_notes", "data_last_updated"] },
];

const TEXTAREA_FIELDS = new Set(["abstract", "spatial_coverage", "sampling_design", "access_conditions", "provenance", "methodology", "citation", "usage_notes", "qc_notes", "expected_variables"]);
const DATE_FIELDS = new Set(["temporal_coverage_start", "temporal_coverage_end", "embargo_until", "qc_date", "data_last_updated"]);

/**
 * What is actually inside the dataset, read from the data itself rather than from what
 * the uploader typed: the variables measured, the period they span and how it downloads.
 * The ficha alone did not say whether the variables someone needs are here.
 */
function DatasetContents({ projectId, accessible }: { projectId: number; accessible: boolean }) {
  const t = useTranslations("datasets");
  const [state, setState] = useState<{ variables: string[]; from: string | null; to: string | null } | "loading" | "error">("loading");

  useEffect(() => {
    if (!accessible) return;
    let active = true;
    Promise.all([downloadService.facets({ project_ids: [projectId] }), dashboardService.getVariableOptions()])
      .then(([facets, options]) => {
        if (!active) return;
        const ids = new Set(facets.variable_ids);
        setState({
          variables: options.filter((o) => o.id !== undefined && ids.has(o.id)).map((o) => o.label),
          from: facets.date_min ?? null,
          to: facets.date_max ?? null,
        });
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [projectId, accessible]);

  if (!accessible) return <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("actions.noAccess")}</p>;
  if (state === "loading") return <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> …</p>;
  if (state === "error") return null;

  const shown = state.variables.slice(0, 30);
  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-[11px] uppercase tracking-wide text-gray-400">{t("detail.variablesMeasured", { count: state.variables.length })}</dt>
        <dd className="mt-1 flex flex-wrap gap-1.5">
          {shown.length ? (
            <>
              {shown.map((v) => (
                <span key={v} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-700">{v}</span>
              ))}
              {state.variables.length > shown.length ? <span className="text-xs text-gray-500">+{state.variables.length - shown.length}</span> : null}
            </>
          ) : (
            <span className="text-gray-500">{t("detail.noVariables")}</span>
          )}
        </dd>
      </div>
      {state.from || state.to ? (
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-400">{t("detail.dataSpan")}</dt>
          <dd className="text-gray-800">{[state.from, state.to].filter(Boolean).join(" → ")}</dd>
        </div>
      ) : null}
      <div>
        <dt className="text-[11px] uppercase tracking-wide text-gray-400">{t("detail.formats")}</dt>
        <dd className="inline-flex items-center gap-1.5 text-gray-800">
          <FileSpreadsheet className="h-4 w-4 text-gray-400" aria-hidden />
          {t("detail.formatsValue")}
        </dd>
      </div>
    </dl>
  );
}

function DatasetDetailModal({
  item,
  canEdit,
  canEditQc,
  accessible,
  onClose,
  onSaved,
}: {
  item: DatasetCatalogueItem;
  canEdit: boolean;
  canEditQc: boolean;
  accessible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("datasets");
  const [meta, setMeta] = useState<ProjectMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  // Keywords carry an AGROVOC URI alongside the label, so they cannot ride in
  // the flat string form the other fields use without losing the URI.
  const [keywordTerms, setKeywordTerms] = useState<AgrovocTerm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    datasetService
      .getMetadata(item.project_id)
      .then((m) => {
        if (active) setMeta(m);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [item.project_id]);

  const startEdit = () => {
    const f: Record<string, string | boolean> = {};
    for (const section of READ_SECTIONS) {
      for (const field of section.fields) {
        const v = meta ? (meta as unknown as Record<string, unknown>)[field] : undefined;
        if (field === "quality_controlled") f[field] = Boolean(v);
        else if (Array.isArray(v)) f[field] = v.join(", ");
        else f[field] = v === null || v === undefined ? "" : String(v);
      }
    }
    setKeywordTerms(toTerms(meta?.keywords));
    if (!f.access_level) f.access_level = "PRIVATE";
    if (!f.qc_status) f.qc_status = "NOT_REVIEWED";
    setForm(f);
    setEditing(true);
  };

  const buildPayload = (): ProjectMetadataUpsert => {
    const payload: Record<string, unknown> = {
      keywords: keywordTerms.length ? keywordTerms : null,
    };
    for (const [key, value] of Object.entries(form)) {
      // Never send QC fields we are not allowed to set: the request would 403 as a whole.
      if (QC_FIELDS.has(key) && !canEditQc) continue;
      if (key === "keywords") continue;
      if (key === "quality_controlled") {
        payload[key] = Boolean(value);
      } else if (CSV_FIELDS.has(key)) {
        const list = String(value).split(",").map((s) => s.trim()).filter(Boolean);
        payload[key] = list.length ? list : null;
      } else {
        const s = String(value).trim();
        payload[key] = s === "" ? null : s;
      }
    }
    return payload as ProjectMetadataUpsert;
  };

  const save = async () => {
    if (!String(form.license ?? "").trim()) {
      setError(t("detail.licenseRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await datasetService.upsertMetadata(item.project_id, buildPayload());
      setMeta(updated);
      setNotFound(false);
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("detail.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const displayValue = (field: string): string => {
    if (!meta) return t("detail.empty");
    const v = (meta as unknown as Record<string, unknown>)[field];
    if (v === null || v === undefined || v === "") return t("detail.empty");
    if (field === "quality_controlled") return v ? "✔" : t("detail.empty");
    if (field === "access_level") return t(`access.${v as AccessLevel}`);
    if (field === "qc_status") return t(`qcStatus.${v as QcStatus}`);
    if (field === "keywords") return keywordLabels(v as never) .join(", ") || t("detail.empty");
    if (Array.isArray(v)) return v.join(", ");
    return String(v);
  };

  /** Fields whose read-mode value is a colored pill (badge) instead of plain text. */
  const badgeValue = (field: string): React.ReactNode | null => {
    if (!meta) return null;
    const v = (meta as unknown as Record<string, unknown>)[field];
    if (field === "access_level" && v) {
      return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCESS_BADGE[v as AccessLevel]}`}>{t(`access.${v as AccessLevel}`)}</span>;
    }
    if (field === "qc_status" && v) {
      return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${QC_BADGE[v as QcStatus]}`}>{t(`qcStatus.${v as QcStatus}`)}</span>;
    }
    if (field === "expected_matrices" && Array.isArray(v) && v.length) {
      return (
        <span className="flex flex-wrap gap-1">
          {(v as string[]).map((m) => (
            <MatrixBadge key={m} value={m} />
          ))}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 rounded-t-2xl border-b border-brand-100 bg-brand-50 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-800">{t("detail.eyebrow")}</p>
            <h2 className="truncate text-lg font-semibold text-brand-900">{item.title || item.name}</h2>
            <p className="font-mono text-[11px] text-brand-700/70">{item.code}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit && !editing ? (
              <button type="button" onClick={startEdit} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Pencil className="h-4 w-4" />
                {t("detail.edit")}
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> …
            </div>
          ) : editing ? (
            <div className="space-y-6">
              {/* The QC section is the reviewing team's; an editor does not even see it. */}
              {READ_SECTIONS.filter((s) => s.key !== "qc" || canEditQc).map((section) => (
                <div key={section.key}>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">{t(`detail.sections.${section.key}`)}</h3>
                  {section.key === "qc" ? (
                    <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("detail.qcNotice")}</p>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <label key={field} className={`block ${TEXTAREA_FIELDS.has(field) ? "sm:col-span-2" : ""}`}>
                        <span className="mb-1 block text-xs font-medium text-gray-600">
                          {t(`fields.${field}`)}
                          {field === "license" ? <span className="text-red-500"> *</span> : null}
                        </span>
                        {field === "keywords" ? (
                          <KeywordsPicker value={keywordTerms} onChange={setKeywordTerms} />
                        ) : field === "quality_controlled" ? (
                          <input type="checkbox" checked={Boolean(form[field])} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.checked }))} className="accent-brand-700" />
                        ) : field === "access_level" ? (
                          <select value={String(form[field] ?? "")} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm">
                            {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{t(`access.${a}`)}</option>)}
                          </select>
                        ) : field === "qc_status" ? (
                          <select value={String(form[field] ?? "")} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm">
                            {QC_STATUSES.map((q) => <option key={q} value={q}>{t(`qcStatus.${q}`)}</option>)}
                          </select>
                        ) : TEXTAREA_FIELDS.has(field) ? (
                          <textarea value={String(form[field] ?? "")} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm" />
                        ) : (
                          <input
                            type={DATE_FIELDS.has(field) ? "date" : "text"}
                            value={String(form[field] ?? "")}
                            onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                            required={field === "license"}
                            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm"
                          />
                        )}
                        {CSV_FIELDS.has(field) ? <span className="mt-0.5 block text-[10px] text-gray-400">{t("fields.listHint")}</span> : null}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{t("detail.cancel")}</button>
                <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-40">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? t("detail.saving") : t("detail.save")}
                </button>
              </div>
            </div>
          ) : notFound ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">{t("detail.noMetadataYet")}</p>
              {canEdit ? (
                <button type="button" onClick={startEdit} className="mt-4 inline-flex rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">{t("detail.createNow")}</button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                <h3 className="mb-2 text-sm font-semibold text-brand-900">{t("actions.title")}</h3>
                <ExploreLinks projectId={item.project_id} accessible={accessible} size="md" />
              </div>
              <div className="border-l-4 border-brand-300 pl-4">
                <h3 className="mb-2 text-sm font-semibold text-brand-800">{t("detail.contents")}</h3>
                <DatasetContents projectId={item.project_id} accessible={accessible} />
              </div>
              {READ_SECTIONS.map((section) => (
                <div key={section.key} className="border-l-4 border-brand-300 pl-4">
                  <h3 className="mb-2 text-sm font-semibold text-brand-800">{t(`detail.sections.${section.key}`)}</h3>
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <div key={field} className="min-w-0">
                        <dt className="text-[11px] uppercase tracking-wide text-gray-400">{t(`fields.${field}`)}</dt>
                        <dd className="text-sm text-gray-800 break-words">{badgeValue(field) ?? displayValue(field)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DatasetCatalogue({
  initialItems,
  canEdit,
  canEditQc,
  filters,
  accessibleProjectIds,
}: {
  initialItems: DatasetCatalogueItem[];
  canEdit: boolean;
  canEditQc: boolean;
  /** Projects whose DATA the user may open. null = unknown, so nothing is disabled. */
  accessibleProjectIds?: number[] | null;
  /** Institución/Matrix/Año, driven by the shared DashboardFilters bar above this component. */
  filters?: DashboardFilterValues;
}) {
  const t = useTranslations("datasets");
  const locale = useLocale();
  const [items, setItems] = useState<DatasetCatalogueItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [openItem, setOpenItem] = useState<DatasetCatalogueItem | null>(null);
  const accessible = useMemo(() => (accessibleProjectIds ? new Set(accessibleProjectIds) : null), [accessibleProjectIds]);
  const canOpenData = (projectId: number) => accessible === null || accessible.has(projectId);

  const refetch = useCallback(() => {
    datasetService.getCatalogue().then(setItems).catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filters?.institution && i.data_source !== filters.institution) return false;
      if (filters?.matrix && !(i.expected_matrices ?? []).includes(filters.matrix)) return false;
      if (filters?.year && !yearMatches(i, filters.year)) return false;
      if (q) {
        const hay = [i.title, i.name, i.code, i.abstract, i.data_source, ...(i.countries ?? []), ...keywordLabels(i.keywords)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const name = (i: DatasetCatalogueItem) => (i.title || i.name || "").toLowerCase();
    const time = (i: DatasetCatalogueItem) => (i.updated_at ? Date.parse(i.updated_at) : 0);
    if (sort === "az") arr.sort((a, b) => name(a).localeCompare(name(b)));
    else if (sort === "za") arr.sort((a, b) => name(b).localeCompare(name(a)));
    else if (sort === "oldest") arr.sort((a, b) => time(a) - time(b));
    else arr.sort((a, b) => time(b) - time(a));
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Institución/Matrix/Año live above this component (DashboardFilters) and
  // change the URL, so a change there should always land back on page 1.
  useEffect(() => {
    setPage(1);
  }, [filters?.institution, filters?.matrix, filters?.year]);

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-medium text-gray-900">{t("title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("filters.searchPlaceholder")} className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">{t("showing", { shown: paged.length, total: sorted.length })}</p>
            <span className="text-xs text-gray-500">{t("filters.sort")}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
              <option value="recent">{t("sort.recent")}</option>
              <option value="oldest">{t("sort.oldest")}</option>
              <option value="az">{t("sort.az")}</option>
              <option value="za">{t("sort.za")}</option>
            </select>
          </div>
        </div>

        {paged.length ? (
          <div className="flex flex-col gap-3">
            {paged.map((item) => (
              <DatasetRow key={item.project_id} item={item} onOpen={() => setOpenItem(item)} query={search} accessible={canOpenData(item.project_id)} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 py-16 text-sm text-gray-500">
            <Database className="h-5 w-5 text-gray-300" /> {t("empty")}
          </div>
        )}

        {sorted.length > perPage ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" onClick={() => setPage(p)} className={`h-8 w-8 rounded-lg text-sm ${p === currentPage ? "bg-brand-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{p}</button>
              ))}
            </div>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
              {[10, 25, 50].map((n) => <option key={n} value={n}>{t("perPage", { count: n })}</option>)}
            </select>
          </div>
        ) : null}

      {openItem ? (
        <DatasetDetailModal
          item={openItem}
          canEdit={canEdit}
          canEditQc={canEditQc}
          accessible={canOpenData(openItem.project_id)}
          onClose={() => setOpenItem(null)}
          onSaved={refetch}
        />
      ) : null}
    </section>
  );
}
