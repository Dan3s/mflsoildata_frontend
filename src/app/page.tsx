"use client";

import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import FeatureCard from "@/app/components/FeatureCard";
import { UIButtonLink } from "@/app/components/ui/button";

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

export default function Home() {
  return (
    <div className="bg-white">
      <Header />

      <section className="bg-gradient-to-b from-green-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-4 text-3xl font-extrabold text-gray-900 sm:text-4xl">Plataforma de Gestión de Datos de Suelos</h1>
            <p className="mx-auto max-w-2xl text-sm text-gray-600">
              Sistema centralizado para el equipo Multifunctional Landscapes de Alianza Bioversity Internacional - CIAT. Almacena, analiza y visualiza datos de investigación de suelos, paisajes y sostenibilidad agrícola.
            </p>

            <div className="mt-6 flex items-center justify-center gap-4">
              <UIButtonLink href="/dashboard" size="lg" className="rounded-full px-5 py-2.5 text-xs">
                Comenzar
              </UIButtonLink>
              <UIButtonLink href="/dashboard" variant="secondary" size="lg" className="rounded-full px-5 py-2.5 text-xs">
                Ver Documentación
              </UIButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Funcionalidades Principales</h2>
          <p className="mx-auto mb-8 max-w-2xl text-sm text-gray-600">Herramientas diseñadas específicamente para facilitar la gestión y análisis de datos de investigación de suelos.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={IconDatabase} title="Base de Datos Centralizada">PostgreSQL con PostGIS para almacenar todos los datos de proyectos de investigación de suelos de forma unificada y escalable.</FeatureCard>
          <FeatureCard icon={IconChart} title="Visualización de Datos">Gráficas configurables y dashboards interactivos para analizar variables de suelo, clima y vegetación por proyecto y sitio.</FeatureCard>
          <FeatureCard icon={IconMap} title="Mapas Geográficos">Visualización espacial de sitios de muestreo con información geográfica detallada y capas de datos contextuales.</FeatureCard>
          <FeatureCard icon={IconUpload} title="Carga de Datos">Importación sencilla desde Excel usando plantillas personalizables, con validación automática de estructura de datos.</FeatureCard>
          <FeatureCard icon={IconDownload} title="Exportación Flexible">Descarga de datos filtrados en formatos estándar (CSV, Excel) para análisis externo y compartir con colaboradores.</FeatureCard>
          <FeatureCard icon={IconRobot} title="Agente IA">Inteligencia artificial para interpretar datos de suelo, generar insights y responder preguntas sobre los resultados.</FeatureCard>
        </div>
      </section>

      <Footer />

    </div>
  );
}