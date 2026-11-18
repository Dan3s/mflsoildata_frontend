"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, X, XCircle } from "lucide-react";
import type { FilterOption } from "@/app/services";
import { ApiError, variablesService } from "@/app/services";
import { MATRIX_OPTIONS } from "@/app/lib/matrixColors";
import { normalizeCode } from "@/app/lib/normalizeCode";

const VALUE_TYPE_KEYS = ["numeric", "text", "boolean", "date"] as const;

/**
 * Form (in a modal) to add a variable to the controlled catalogue. Used from the template step of
 * the upload and from Manual entry; only people who manage the catalogue are offered it.
 */
export default function NewVariableModal({
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
