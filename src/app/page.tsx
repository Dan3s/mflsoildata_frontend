import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Database, MapPin, FlaskConical, Globe, ArrowRight } from "lucide-react";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import FeatureCard from "@/app/components/FeatureCard";
import WavyUnderline from "@/app/components/WavyUnderline";
import { UIButtonLink } from "@/app/components/ui/button";
import { dashboardService } from "@/app/services";

const IconDatabase = (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 3C7.582 3 4 4.79 4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7c0-2.21-3.582-4-8-4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconChart = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 13v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 9v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconMap = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M9 3l6 2v14l-6-2V3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 6l6 2v12L3 18V6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 5l6 2v12l-6-2V5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconUpload = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21 15v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 5v10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconDownload = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21 15v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 13l5 5 5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 13V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconRobot = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="7" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
    <path d="M8 3v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M16 3v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M9 12h.01M15 12h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Cycled across the stats tiles and the feature cards so nothing is a single flat color. */
const ACCENT_COLORS = [
  "bg-brand-100 text-brand-800",
  "bg-earth-100 text-earth-800",
  "bg-teal-100 text-teal-800",
  "bg-purple-100 text-purple-800",
];

function HowItWorksCard({ icon, title, body, href }: { icon: React.ReactNode; title: string; body: string; href: string }) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-800">
        {icon}
      </div>
      <h4 className="mb-2 text-base font-semibold text-gray-800">{title}</h4>
      <p className="mb-3 text-sm text-gray-600">{body}</p>
      <ArrowRight className="h-4 w-4 text-brand-700 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

export default async function Home() {
  const t = await getTranslations("home");
  const summary = await dashboardService.getPublicSummary().catch(() => null);

  const stats = [
    { key: "datasets", label: t("stats.datasets"), value: summary?.datasets, icon: <Database className="h-5 w-5" /> },
    { key: "sites", label: t("stats.sites"), value: summary?.sites, icon: <MapPin className="h-5 w-5" /> },
    { key: "samples", label: t("stats.samples"), value: summary?.samples, icon: <FlaskConical className="h-5 w-5" /> },
    { key: "countries", label: t("stats.countries"), value: summary?.countries, icon: <Globe className="h-5 w-5" /> },
  ];

  return (
    <div className="bg-white">
      <Header />

      <section className="bg-gradient-to-br from-brand-800 to-brand-900 pb-24">
        <div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-200">{t("eyebrow")}</p>
            <h1 className="mb-4 text-3xl font-extrabold text-white sm:text-4xl">{t("heroTitle")}</h1>
            <p className="mx-auto max-w-2xl text-sm text-brand-100">{t("heroSubtitle")}</p>

            <div className="mt-8 flex items-center justify-center gap-4">
              <UIButtonLink href="/dashboard" size="lg" className="px-5 py-2.5 text-xs">
                {t("start")}
              </UIButtonLink>
              <UIButtonLink href="/dashboard" variant="secondary" size="lg" className="px-5 py-2.5 text-xs">
                {t("viewDocs")}
              </UIButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Floating stats card, overlapping the hero/next-section boundary. */}
      <div className="mx-auto -mt-14 max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 rounded-2xl bg-white p-6 shadow-lg sm:grid-cols-4 sm:p-8">
          {stats.map((stat, i) => (
            <div key={stat.key} className="flex flex-col items-center text-center">
              <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${ACCENT_COLORS[i]}`}>
                {stat.icon}
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value ?? "—"}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-earth-600">{t("howItWorks.eyebrow")}</p>
          <h2 className="mb-3 text-xl font-semibold text-gray-900">{t("howItWorks.title")}</h2>
          <WavyUnderline className="mb-4 text-earth-400" />
          <p className="mx-auto max-w-2xl text-sm text-gray-600">{t("howItWorks.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <HowItWorksCard icon={IconChart} title={t("howItWorks.explore.title")} body={t("howItWorks.explore.body")} href="/dashboard" />
          <HowItWorksCard icon={IconUpload} title={t("howItWorks.upload.title")} body={t("howItWorks.upload.body")} href="/dashboard/upload" />
          <HowItWorksCard icon={IconDownload} title={t("howItWorks.download.title")} body={t("howItWorks.download.body")} href="/dashboard/download" />
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="mb-3 text-xl font-semibold text-gray-900">{t("featuresTitle")}</h2>
            <WavyUnderline className="mb-4 text-brand-400" />
            <p className="mx-auto mb-8 max-w-2xl text-sm text-gray-600">{t("featuresSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon={IconDatabase} title={t("features.databaseTitle")} iconColorClass={ACCENT_COLORS[0]}>{t("features.databaseBody")}</FeatureCard>
            <FeatureCard icon={IconChart} title={t("features.vizTitle")} iconColorClass={ACCENT_COLORS[1]}>{t("features.vizBody")}</FeatureCard>
            <FeatureCard icon={IconMap} title={t("features.mapTitle")} iconColorClass={ACCENT_COLORS[2]}>{t("features.mapBody")}</FeatureCard>
            <FeatureCard icon={IconUpload} title={t("features.uploadTitle")} iconColorClass={ACCENT_COLORS[3]}>{t("features.uploadBody")}</FeatureCard>
            <FeatureCard icon={IconDownload} title={t("features.downloadTitle")} iconColorClass={ACCENT_COLORS[0]}>{t("features.downloadBody")}</FeatureCard>
            <FeatureCard icon={IconRobot} title={t("features.aiTitle")} iconColorClass={ACCENT_COLORS[1]}>{t("features.aiBody")}</FeatureCard>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
