"use client";

import { useTranslations } from "next-intl";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";

const CONTACT_EMAILS = ["j.m.martin@cgiar.org", "d.e.guzman@cgiar.org"];

export default function ContactPage() {
  const t = useTranslations("contact");

  return (
    <div className="bg-white">
      <Header />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-4 text-3xl font-extrabold text-gray-900 sm:text-4xl">{t("title")}</h1>
        <p className="mb-8 text-base leading-relaxed text-gray-700">{t("body")}</p>

        <ul className="space-y-3">
          {CONTACT_EMAILS.map((email) => (
            <li key={email}>
              <a href={`mailto:${email}`} className="text-base font-medium text-brand-800 hover:underline">
                {email}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <Footer />
    </div>
  );
}
