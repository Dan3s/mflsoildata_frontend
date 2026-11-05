import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Cookie-based locale resolution (no URL routing): the locale lives in the
 * `NEXT_LOCALE` cookie and defaults to English. Works in both server and client
 * components via next-intl.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = (locales as readonly string[]).includes(cookieLocale ?? "")
    ? (cookieLocale as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
