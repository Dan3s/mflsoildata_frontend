"use client";

import { useTranslations } from "next-intl";
import type { UseDataverseDownload } from "./useDataverseDownload";

/**
 * The Guestbook form itself, shared by the standalone Dataverse browser and
 * the upload wizard's Dataverse step — same copy and fields everywhere it
 * appears, driven entirely by a `useDataverseDownload()` instance.
 */
export function DataverseGuestbookForm({ state }: { state: UseDataverseDownload }) {
  const t = useTranslations("dataverse.browser.guestbook");
  const gb = state.guestbook;
  if (!gb) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-800">{t("title", { name: gb.name })}</p>
      <p className="mt-1 text-xs text-amber-700">{t("body")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            {t("name")}
            {gb.name_required && " *"}
          </label>
          <input
            value={state.guestbookName}
            onChange={(e) => state.setGuestbookName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            {t("email")}
            {gb.email_required && " *"}
          </label>
          <input
            value={state.guestbookEmail}
            onChange={(e) => state.setGuestbookEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        {gb.institution_required && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">{t("institution")} *</label>
            <input
              value={state.guestbookInstitution}
              onChange={(e) => state.setGuestbookInstitution(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
        )}
        {gb.position_required && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">{t("position")} *</label>
            <input
              value={state.guestbookPosition}
              onChange={(e) => state.setGuestbookPosition(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
        )}
        {gb.custom_questions.map((q) => (
          <div key={q.id} className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {q.question}
              {q.required && " *"}
            </label>
            <input
              value={state.guestbookAnswers[q.id] || ""}
              onChange={(e) => state.setGuestbookAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => state.confirmGuestbook()}
        className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
      >
        {t("confirm")}
      </button>
    </div>
  );
}
