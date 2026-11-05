"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import Logo from "@/app/components/Logo";
import PartnerLogo from "@/app/components/PartnerLogo";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

const Header = () => {
  const t = useTranslations();
  const { status } = useSession();
  const isSignedIn = status === "authenticated";

  return (
    <header className="border-b border-emerald-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-gray-900">
          <Logo className="h-9 w-9" />
          <span className="flex flex-col leading-tight">
            <span>{t("common.appName")}</span>
            <span className="text-[10px] font-normal text-gray-500">{t("common.appSubtitle")}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          <Link href="/about" className="text-sm font-medium text-gray-700 hover:text-brand-800">
            {t("nav.about")}
          </Link>
          <Link href="/contact" className="text-sm font-medium text-gray-700 hover:text-brand-800">
            {t("nav.contact")}
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <PartnerLogo className="hidden h-8 sm:block" />
          <LanguageSwitcher />
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800"
            >
              {t("common.goToDashboard")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => signIn("keycloak", { callbackUrl: "/dashboard" })}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800"
            >
              {t("common.signIn")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
