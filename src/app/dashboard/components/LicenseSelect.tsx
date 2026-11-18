"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Common data licenses. Ids are what gets stored (SPDX identifiers); `key` is the
 * translation key for the plain-language description (a dot is not allowed in one).
 * Anything else can still be typed through "Other".
 */
export const LICENSE_OPTIONS = [
  { id: "CC-BY-4.0", key: "cc_by" },
  { id: "CC0-1.0", key: "cc0" },
  { id: "CC-BY-SA-4.0", key: "cc_by_sa" },
  { id: "CC-BY-NC-4.0", key: "cc_by_nc" },
  { id: "CC-BY-NC-SA-4.0", key: "cc_by_nc_sa" },
  { id: "ODbL-1.0", key: "odbl" },
] as const;

const OTHER = "__other__";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm outline-none focus:border-brand-400 focus:bg-white";

/**
 * A license is a choice most people do not know how to write: offer the usual ones
 * with what each one means, and keep a free-text way out for the rest (a value
 * imported from elsewhere that is not on the list shows up as "Other" with its text).
 */
export function LicenseSelect({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const t = useTranslations("datasets");
  const known = LICENSE_OPTIONS.some((o) => o.id === value);
  // "Other" with nothing typed yet is still "Other": the select must not jump back.
  const [forceOther, setForceOther] = useState(false);
  const selected = forceOther || (value !== "" && !known) ? OTHER : value;

  return (
    <div className="space-y-2">
      <select
        value={selected}
        required={required}
        onChange={(e) => {
          const next = e.target.value;
          if (next === OTHER) {
            setForceOther(true);
            if (known) onChange("");
          } else {
            setForceOther(false);
            onChange(next);
          }
        }}
        className={SELECT_CLASS}
      >
        <option value="">{t("licenseChoose")}</option>
        {LICENSE_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.id} — {t(`licenseOptions.${o.key}`)}
          </option>
        ))}
        <option value={OTHER}>{t("licenseOther")}</option>
      </select>
      {selected === OTHER ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("licenseOtherPlaceholder")}
          aria-label={t("licenseOther")}
          className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
        />
      ) : null}
    </div>
  );
}
