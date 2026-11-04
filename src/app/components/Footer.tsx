"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import PartnerLogo from "@/app/components/PartnerLogo";

const Footer = () => {
  const t = useTranslations();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <h4 className="mb-2 font-semibold">{t("common.appName")}</h4>
            <p className="text-sm text-gray-400">{t("footer.description")}</p>
            <PartnerLogo className="mt-4 h-8" />
          </div>

          <div>
            <h4 className="mb-2 font-semibold">
              <Link href="/about" className="hover:text-brand-300">{t("footer.aboutTitle")}</Link>
            </h4>
            <ul className="text-sm text-gray-400">
              <li>{t("footer.about1")}</li>
              <li>{t("footer.about2")}</li>
              <li>{t("footer.about3")}</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-2 font-semibold">{t("footer.supportTitle")}</h4>
            <ul className="text-sm text-gray-400">
              <li>{t("footer.support1")}</li>
              <li>{t("footer.support2")}</li>
              <li>
                <Link href="/contact" className="hover:text-brand-300">{t("footer.support3")}</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-800 pt-6 text-sm text-gray-500">
          {t("footer.rights", { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
