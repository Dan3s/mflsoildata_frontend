"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

const OPTIONS = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
] as const;

const YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Cookie-based language toggle. Sets the `NEXT_LOCALE` cookie and refreshes so
 * server components re-render in the new locale (no URL change).
 */
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: string) => {
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=${YEAR_SECONDS};samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <div className={`inline-flex overflow-hidden rounded-full border border-gray-200 ${className}`}>
      {OPTIONS.map((option) => {
        const active = option.code === locale;
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => change(option.code)}
            disabled={pending}
            aria-pressed={active}
            className={`px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
              active ? "bg-brand-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
