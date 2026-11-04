import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { signIn } from "@/auth";
import Logo from "@/app/components/Logo";
import PartnerLogo from "@/app/components/PartnerLogo";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import AutoReauth from "./AutoReauth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; expired?: string }>;
}) {
  const { callbackUrl, expired } = await searchParams;
  const target = callbackUrl || "/dashboard";
  const t = await getTranslations();
  // Keycloak renders its own login page; ui_locales makes it follow the app
  // language instead of the browser's Accept-Language.
  const locale = await getLocale();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      {expired ? <AutoReauth callbackUrl={target} locale={locale} /> : null}

      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <div className="mb-6 flex flex-col items-center text-center">
        <Logo className="h-16 w-16" />
        <h1 className="mt-4 text-3xl font-bold text-gray-900">{t("common.appName")}</h1>
        <p className="mt-1 text-gray-500">{t("common.appSubtitle")}</p>
        <PartnerLogo className="mt-4 h-9" />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">{t("login.title")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("login.subtitle")}</p>

        {expired ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {t("login.expiredBanner")}
          </div>
        ) : null}

        <form
          action={async () => {
            "use server";
            await signIn("keycloak", { redirectTo: target }, { ui_locales: locale });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="w-full rounded-xl bg-brand-700 px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-800"
          >
            {t("login.button")}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">{t("login.footerNote")}</p>
      </div>

      <Link href="/" className="mt-6 text-sm text-gray-500 hover:text-gray-700">
        {t("login.backHome")}
      </Link>
    </div>
  );
}
