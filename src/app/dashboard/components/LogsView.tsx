"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, X, Loader2, Clock, FileSpreadsheet, ClipboardCheck, ChevronDown, ChevronUp, Search, AlertTriangle } from "lucide-react";
import { submissionService, downloadService, variablesService, ApiError } from "@/app/services";
import type {
  FilterOption,
  RecentDownload,
  SubmissionItem,
  SubmissionRowsResponse,
  SubmissionStatus,
  VariableRead,
  VariableResolution,
} from "@/app/services";
import NewVariablesReview, { buildResolutions, defaultDraft, type VariableDraft } from "./NewVariablesReview";

/** Shape of the 409 body the API returns when rows already exist. */
type ConflictPayload = { detail?: { message?: string; conflict_count?: number } };
type DecideError = { id: number; message: string; conflicts?: number };

const STATUS_BADGE: Record<SubmissionStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-brand-100 text-brand-800",
  REJECTED: "bg-red-100 text-red-700",
};

export default function LogsView({ canViewDownloads }: { canViewDownloads: boolean }) {
  const t = useTranslations("logs");
  const locale = useLocale();
  const fmtDate = useMemo(
    () => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CO", { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  const fmtDateTime = (iso?: string | null) => (iso ? fmtDate.format(new Date(iso)) : "—");

  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "ALL">("PENDING");
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const [downloads, setDownloads] = useState<RecentDownload[]>([]);
  const [decideError, setDecideError] = useState<DecideError | null>(null);

  // Row preview: one submission expanded at a time, paged server-side because a
  // staged file can hold thousands of rows.
  const [openId, setOpenId] = useState<number | null>(null);
  const [rowsData, setRowsData] = useState<SubmissionRowsResponse | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowSearch, setRowSearch] = useState("");
  const [rowOffset, setRowOffset] = useState(0);
  const ROWS_PER_PAGE = 25;

  const loadSubs = useCallback(() => {
    setLoadingSubs(true);
    submissionService
      .list(statusFilter === "ALL" ? undefined : statusFilter)
      .then(setSubmissions)
      .catch(() => setSubmissions([]))
      .finally(() => setLoadingSubs(false));
  }, [statusFilter]);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  // Reviewer decisions about the uploader's new variables, per submission. The
  // catalogue (to merge into) and the units are only fetched when a pending
  // submission actually carries new variables.
  const [drafts, setDrafts] = useState<Record<number, Record<string, VariableDraft>>>({});
  const [catalogue, setCatalogue] = useState<VariableRead[]>([]);
  const [units, setUnits] = useState<FilterOption[]>([]);
  const needsCatalogue = submissions.some((s) => s.status === "PENDING" && (s.new_variables?.length ?? 0) > 0);
  useEffect(() => {
    if (!needsCatalogue || catalogue.length > 0) return;
    variablesService.getAll().then(setCatalogue).catch(() => setCatalogue([]));
    variablesService.getUnits().then(setUnits).catch(() => setUnits([]));
  }, [needsCatalogue, catalogue.length]);

  const patchDraft = (submissionId: number, code: string, patch: Partial<VariableDraft>) =>
    setDrafts((prev) => {
      const current = prev[submissionId]?.[code];
      const sub = submissions.find((s) => s.id === submissionId);
      const def = sub?.new_variables?.find((d) => d.code === code);
      if (!def) return prev;
      const base = current ?? defaultDraft(def);
      return { ...prev, [submissionId]: { ...prev[submissionId], [code]: { ...base, ...patch } } };
    });

  useEffect(() => {
    if (!canViewDownloads) return;
    downloadService.getAudit().then(setDownloads).catch(() => setDownloads([]));
  }, [canViewDownloads]);

  // Debounced so typing in the row search does not fire a request per keystroke.
  useEffect(() => {
    if (openId === null) return;
    setRowsLoading(true);
    const timer = setTimeout(() => {
      submissionService
        .rows(openId, { search: rowSearch.trim() || undefined, offset: rowOffset, limit: ROWS_PER_PAGE })
        .then(setRowsData)
        .catch(() => setRowsData(null))
        .finally(() => setRowsLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [openId, rowSearch, rowOffset]);

  const toggleRows = (id: number) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    setRowsData(null);
    setRowSearch("");
    setRowOffset(0);
  };

  const decide = async (id: number, action: "approve" | "reject", notes?: string) => {
    // An incomplete decision about a new variable is caught here, before any request.
    let variableResolutions: VariableResolution[] | undefined;
    if (action === "approve") {
      const defs = submissions.find((s) => s.id === id)?.new_variables ?? [];
      const built = buildResolutions(defs, drafts[id] ?? {});
      if ("error" in built) {
        setDecideError({
          id,
          message:
            built.error === "pickMergeTarget"
              ? t("approval.newVars.pickMergeTarget", { name: built.def.name })
              : t("approval.newVars.nameRequired", { code: built.def.code }),
        });
        return;
      }
      variableResolutions = built.resolutions.length ? built.resolutions : undefined;
    }
    setBusyId(id);
    try {
      if (action === "approve") await submissionService.approve(id, notes, variableResolutions);
      else await submissionService.reject(id, notes);
      setRejectingId(null);
      setRejectNotes("");
      setOpenId(null);
      setDecideError(null);
      loadSubs();
    } catch (err) {
      // A 409 means the rows already exist (another submission got there first).
      // The submission stays PENDING, so tell the reviewer instead of failing mute.
      const payload = err instanceof ApiError ? (err.payload as ConflictPayload | undefined) : undefined;
      const detail = payload?.detail;
      setDecideError({
        id,
        message: detail?.message ?? t("approval.decideFailed"),
        conflicts: detail?.conflict_count,
      });
    } finally {
      setBusyId(null);
    }
  };

  // While PENDING nothing is written yet, so the counts come from the dry-run
  // estimate; `inserted` is only filled once the ETL runs on approval.
  const insertedSummary = (s: SubmissionItem) => {
    const counts = s.inserted ?? s.summary;
    return counts
      ? Object.entries(counts)
          .filter(([, v]) => v)
          .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
          .join(" · ")
      : "";
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px] space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
        </div>

        {/* Approval queue */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-brand-700" />
              <div>
                <h2 className="text-base font-semibold text-gray-900">{t("approval.title")}</h2>
                <p className="text-xs text-gray-500">{t("approval.subtitle")}</p>
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus | "ALL")}
              className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700"
            >
              <option value="PENDING">{t("status.PENDING")}</option>
              <option value="APPROVED">{t("status.APPROVED")}</option>
              <option value="REJECTED">{t("status.REJECTED")}</option>
              <option value="ALL">{t("approval.all")}</option>
            </select>
          </div>

          {loadingSubs ? (
            <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> …
            </div>
          ) : submissions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">{t("approval.empty")}</p>
          ) : (
            <div className="space-y-3">
              {submissions.map((s) => (
                <div key={s.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{s.project_name || s.project_code || `#${s.id}`}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s.status]}`}>{t(`status.${s.status}`)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {(s.submitted_by_name || s.submitted_by_email || t("approval.unknownUser"))}
                        {(s.organization || s.country) ? ` · ${[s.organization, s.country].filter(Boolean).join(" · ")}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateTime(s.submitted_at)}</span>
                        {insertedSummary(s) ? <><span>·</span><span>{insertedSummary(s)}</span></> : null}
                      </div>
                      {s.review_notes ? <p className="mt-1 text-xs text-gray-500">{t("approval.notes")}: {s.review_notes}</p> : null}
                      <button
                        type="button"
                        onClick={() => toggleRows(s.id)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-900"
                      >
                        {openId === s.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {t("approval.viewRows", { count: s.total_rows ?? 0 })}
                        {s.filename ? <span className="text-gray-400">· {s.filename}</span> : null}
                      </button>
                    </div>

                    {s.status === "PENDING" ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decide(s.id, "approve")}
                          disabled={busyId === s.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-40"
                        >
                          {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          {t("approval.approve")}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejectingId(rejectingId === s.id ? null : s.id); setRejectNotes(""); }}
                          disabled={busyId === s.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" />
                          {t("approval.reject")}
                        </button>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs text-gray-400">{s.reviewed_by_name || s.reviewed_by_email || ""} · {fmtDateTime(s.reviewed_at)}</span>
                    )}
                  </div>

                  {s.status === "PENDING" && (s.new_variables?.length ?? 0) > 0 ? (
                    <NewVariablesReview
                      defs={s.new_variables ?? []}
                      drafts={drafts[s.id] ?? {}}
                      onChange={(code, patch) => patchDraft(s.id, code, patch)}
                      catalogue={catalogue}
                      units={units}
                      disabled={busyId === s.id}
                    />
                  ) : null}

                  {decideError?.id === s.id ? (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <p className="text-xs text-red-700">
                        {decideError.message}
                        {decideError.conflicts
                          ? ` (${t("approval.conflictRows", { count: decideError.conflicts })})`
                          : ""}
                      </p>
                    </div>
                  ) : null}

                  {rejectingId === s.id ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        placeholder={t("approval.rejectReason")}
                        className="h-9 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-red-400 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => decide(s.id, "reject", rejectNotes.trim() || undefined)}
                        disabled={busyId === s.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
                      >
                        {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {t("approval.confirmReject")}
                      </button>
                    </div>
                  ) : null}

                  {openId === s.id ? (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                          <input
                            value={rowSearch}
                            onChange={(e) => { setRowSearch(e.target.value); setRowOffset(0); }}
                            placeholder={t("approval.searchRows")}
                            className="h-8 w-64 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-brand-400"
                          />
                        </div>
                        {rowsData ? (
                          <span className="text-xs text-gray-500">
                            {t("approval.rowsRange", {
                              from: rowsData.total === 0 ? 0 : rowsData.offset + 1,
                              to: Math.min(rowsData.offset + rowsData.limit, rowsData.total),
                              total: rowsData.total,
                            })}
                          </span>
                        ) : null}
                      </div>

                      {rowsLoading ? (
                        <div className="flex items-center gap-2 py-6 text-xs text-gray-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> …
                        </div>
                      ) : !rowsData || rowsData.rows.length === 0 ? (
                        <p className="py-6 text-center text-xs text-gray-400">{t("approval.noRows")}</p>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px] text-left text-xs">
                              <thead className="text-gray-500">
                                <tr className="border-b border-gray-200">
                                  <th className="px-2 py-1.5 font-medium">#</th>
                                  {Object.keys(rowsData.rows[0].data).map((col) => (
                                    <th key={col} className="whitespace-nowrap px-2 py-1.5 font-medium">
                                      {col.replace(/_/g, " ")}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rowsData.rows.map((r, i) => (
                                  <tr key={`${r.row_number ?? i}`} className="border-b border-gray-100 last:border-0">
                                    <td className="px-2 py-1.5 text-gray-400">{r.row_number ?? "—"}</td>
                                    {Object.keys(rowsData.rows[0].data).map((col) => (
                                      <td key={col} className="whitespace-nowrap px-2 py-1.5 text-gray-700">
                                        {r.data[col] === null || r.data[col] === undefined || r.data[col] === ""
                                          ? "—"
                                          : String(r.data[col])}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {rowsData.total > ROWS_PER_PAGE ? (
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setRowOffset(Math.max(0, rowOffset - ROWS_PER_PAGE))}
                                disabled={rowOffset === 0}
                                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 disabled:opacity-40"
                              >
                                {t("approval.prev")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRowOffset(rowOffset + ROWS_PER_PAGE)}
                                disabled={rowOffset + ROWS_PER_PAGE >= rowsData.total}
                                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 disabled:opacity-40"
                              >
                                {t("approval.next")}
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Download logs (admin only) */}
        {canViewDownloads ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">{t("downloads.title")}</h2>
            <p className="mb-4 text-xs text-gray-500">{t("downloads.subtitle")}</p>
            {downloads.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">{t("downloads.empty")}</p>
            ) : (
              <div className="space-y-3">
                {downloads.map((d) => (
                  <div key={String(d.id ?? d.filename)} className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 shrink-0">
                      <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{d.username || d.user_email || t("downloads.unknownUser")}</p>
                      {(d.organization || d.country) ? (
                        <p className="truncate text-xs text-gray-500">{[d.organization, d.country].filter(Boolean).join(" · ")}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateTime(d.created_at)}</span>
                        <span>·</span>
                        <span className="uppercase">{d.format ?? "—"}</span>
                        {d.record_count !== null && d.record_count !== undefined ? (
                          <><span>·</span><span>{t("downloads.records", { count: d.record_count.toLocaleString(locale === "en" ? "en-US" : "es-CO") })}</span></>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
