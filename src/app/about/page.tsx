"use client";

import { useTranslations } from "next-intl";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <div className="bg-white">
      <Header />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-3xl font-extrabold text-gray-900 sm:text-4xl">{t("title")}</h1>
        <p className="mb-4 text-base leading-relaxed text-gray-700">{t("body1")}</p>
        <p className="text-base leading-relaxed text-gray-700">{t("body2")}</p>
      </section>

      <Footer />
    </div>
  );
}
