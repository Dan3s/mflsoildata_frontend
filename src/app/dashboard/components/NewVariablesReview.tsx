"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { MATRIX_OPTIONS } from "@/app/lib/matrixColors";
import type { FilterOption, NewVariableDef, VariableRead, VariableResolution } from "@/app/services";

/** What the reviewer has decided so far for one new variable (form state, all strings). */
export type VariableDraft = {
  action: "create" | "merge";
  variableId: string;
  name: string;
  matrix: string;
  unitId: string;
  domain: string;
  description: string;
};

export const defaultDraft = (d: NewVariableDef): VariableDraft => ({
  action: "create",
  variableId: "",
  name: d.name,
  matrix: d.matrix ?? "",
  unitId: d.unit_id ? String(d.unit_id) : "",
  domain: d.domain ?? "",
  description: d.description ?? "",
});

/**
 * Turns the drafts into the API payload. Only what the reviewer actually changed
 * is sent, so an untouched variable is created exactly as the uploader described
 * it. Returns the first problem (as a message key + code) instead of a payload
 * when a decision is incomplete.
 */
export function buildResolutions(
  defs: NewVariableDef[],
  drafts: Record<string, VariableDraft | undefined>,
): { resolutions: VariableResolution[] } | { error: "pickMergeTarget" | "nameRequired"; def: NewVariableDef } {
  const resolutions: VariableResolution[] = [];
  for (const d of defs) {
    const draft = drafts[d.code];
    if (!draft) continue;
    if (draft.action === "merge") {
      if (!draft.variableId) return { error: "pickMergeTarget", def: d };
      resolutions.push({ code: d.code, action: "merge", variable_id: Number(draft.variableId) });
      continue;
    }
    if (!draft.name.trim()) return { error: "nameRequired", def: d };
    const edit: VariableResolution = { code: d.code, action: "create" };
    let changed = false;
    if (draft.name.trim() !== d.name) {
      edit.name = draft.name.trim();
      changed = true;
    }
    if (draft.matrix !== (d.matrix ?? "")) {
      edit.matrix = draft.matrix || null;
      changed = true;
    }
    if (draft.unitId !== (d.unit_id ? String(d.unit_id) : "")) {
      edit.unit_id = draft.unitId ? Number(draft.unitId) : null;
      changed = true;
    }
    if (draft.domain.trim() !== (d.domain ?? "")) {
      edit.domain = draft.domain.trim();
      changed = true;
    }
    if (draft.description.trim() !== (d.description ?? "")) {
      edit.description = draft.description.trim() || null;
      changed = true;
    }
    if (changed) resolutions.push(edit);
  }
  return { resolutions };
}

const fieldCls =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none focus:border-brand-400 disabled:bg-gray-50 disabled:text-gray-400";

type Props = {
  defs: NewVariableDef[];
  drafts: Record<string, VariableDraft | undefined>;
  onChange: (code: string, patch: Partial<VariableDraft>) => void;
  /** Existing catalogue variables, for the merge choice. */
  catalogue: VariableRead[];
  units: FilterOption[];
  disabled?: boolean;
};

/** Domains already in use, to suggest when typing one. */
const domainsOf = (catalogue: VariableRead[]) =>
  Array.from(new Set(catalogue.map((v) => v.domain).filter(Boolean))).sort();

/** Reviewer panel: the variables an uploader defined, each to be created (editable) or merged. */
export default function NewVariablesReview({ defs, drafts, onChange, catalogue, units, disabled }: Props) {
  const t = useTranslations("logs.approval.newVars");
  const tv = useTranslations("upload.valueTypes");
  const domains = domainsOf(catalogue);

  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{t("title", { count: defs.length })}</h4>
          <p className="text-xs text-gray-500">{t("subtitle")}</p>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {defs.map((d) => {
          const draft = drafts[d.code] ?? defaultDraft(d);
          const merging = draft.action === "merge";
          const targets = catalogue
            .filter((v) => v.value_type === d.value_type)
            .sort((a, b) => (a.label ?? a.name ?? "").localeCompare(b.label ?? b.name ?? ""));
          const unitTyped = d.unit && !d.unit_id ? d.unit : null;

          return (
            <div key={d.code} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-gray-500">{d.code}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {tv(d.value_type as "numeric" | "text" | "boolean" | "date")}
                </span>
                {d.similar_to ? (
                  <span className="inline-flex flex-wrap items-center gap-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                    {t("similarHint", { name: d.similar_to.name })}
                    {/* Only offered when a merge is possible (same kind of value). */}
                    {targets.some((v) => v.id === d.similar_to!.id) ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(d.code, { action: "merge", variableId: String(d.similar_to!.id) })}
                        className="font-medium underline underline-offset-2 hover:text-amber-900 disabled:opacity-40"
                      >
                        {t("useSimilar")}
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-700">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`action-${d.code}`}
                    checked={!merging}
                    disabled={disabled}
                    onChange={() => onChange(d.code, { action: "create" })}
                  />
                  {t("actionCreate")}
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`action-${d.code}`}
                    checked={merging}
                    disabled={disabled}
                    onChange={() => onChange(d.code, { action: "merge" })}
                  />
                  {t("actionMerge")}
                </label>
              </div>

              {merging ? (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-gray-600">{t("mergeInto")}</label>
                  <select
                    value={draft.variableId}
                    disabled={disabled}
                    onChange={(e) => onChange(d.code, { variableId: e.target.value })}
                    className={fieldCls}
                  >
                    <option value="">{t("choose")}</option>
                    {targets.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label ?? v.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">{t("onlySameType")}</p>
                </div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600">{t("name")}</label>
                    <input
                      value={draft.name}
                      disabled={disabled}
                      onChange={(e) => onChange(d.code, { name: e.target.value })}
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{t("matrix")}</label>
                    <select
                      value={draft.matrix}
                      disabled={disabled}
                      onChange={(e) => onChange(d.code, { matrix: e.target.value })}
                      className={fieldCls}
                    >
                      <option value="">—</option>
                      {MATRIX_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{t("unit")}</label>
                    <select
                      value={draft.unitId}
                      disabled={disabled}
                      onChange={(e) => onChange(d.code, { unitId: e.target.value })}
                      className={fieldCls}
                    >
                      <option value="">{t("noUnit")}</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    {unitTyped ? (
                      <p className="mt-1 text-xs text-amber-600">{t("unitTyped", { unit: unitTyped })}</p>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600">{t("domain")}</label>
                    <input
                      value={draft.domain}
                      disabled={disabled}
                      list={`domains-${d.code}`}
                      placeholder="CUSTOM"
                      onChange={(e) => onChange(d.code, { domain: e.target.value })}
                      className={fieldCls}
                    />
                    <datalist id={`domains-${d.code}`}>
                      {domains.map((dom) => (
                        <option key={dom} value={dom} />
                      ))}
                    </datalist>
                    <p className="mt-1 text-xs text-gray-400">{t("domainHint")}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600">{t("description")}</label>
                    <input
                      value={draft.description}
                      disabled={disabled}
                      onChange={(e) => onChange(d.code, { description: e.target.value })}
                      className={fieldCls}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
