export interface AppConfig {
  name: string;
  displayName: string;
  about: {
    title: string;
    description: string;
  };
}

export const baseConfig: AppConfig = {
  name: "default",
  displayName: "MFL Soil Data",
  about: {
    title: "Sobre la plataforma",
    description: "Estructura base lista para agregar secciones y vistas.",
  },
};