/**
 * Cross-page filter persistence. Same pattern as the `NEXT_LOCALE` cookie
 * (src/i18n/request.ts + LanguageSwitcher.tsx): a cookie readable on the server,
 * no React context. Holds only the filters that repeat across several screens
 * today (institution, country, matrix) — not every filter in the app.
 */

export type GlobalFilterState = {
  institution?: string;
  country?: string;
  matrix?: string;
};

export const GLOBAL_FILTERS_COOKIE = "MFL_FILTERS";
const YEAR_SECONDS = 60 * 60 * 24 * 365;

const parse = (raw: string | undefined): GlobalFilterState => {
  if (!raw) return {};
  try {
    const value = JSON.parse(decodeURIComponent(raw));
    return value && typeof value === "object" ? (value as GlobalFilterState) : {};
  } catch {
    return {};
  }
};

/** Server-side read (Server Components / route handlers). */
export async function readGlobalFilters(): Promise<GlobalFilterState> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return parse(store.get(GLOBAL_FILTERS_COOKIE)?.value);
}

/** Client-side read (e.g. to seed a client component's initial state before first paint). */
export function readGlobalFiltersClient(): GlobalFilterState {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|; )MFL_FILTERS=([^;]*)/);
  return parse(match?.[1]);
}

/** Client-side write: merges the patch into the cookie so other tabs/fields are preserved. */
export function writeGlobalFilters(patch: Partial<GlobalFilterState>): void {
  if (typeof document === "undefined") return;
  const next = { ...readGlobalFiltersClient(), ...patch };
  document.cookie = `${GLOBAL_FILTERS_COOKIE}=${encodeURIComponent(JSON.stringify(next))};path=/;max-age=${YEAR_SECONDS};samesite=lax`;
}
