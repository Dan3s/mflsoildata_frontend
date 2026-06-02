"use client";

import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(
  async () => {
    const [{ default: createPlotlyComponent }, plotlyModule] = await Promise.all([
      import("react-plotly.js/factory"),
      import("plotly.js-dist-min"),
    ]);

    const plotlyInstance = (plotlyModule as { default?: unknown }).default ?? plotlyModule;

    return createPlotlyComponent(plotlyInstance as never);
  },
  {
    ssr: false,
    loading: () => <div className="flex h-[28rem] items-center justify-center text-sm text-gray-500">Cargando gráfica...</div>,
  },
);

export default function PlotlyFigure(props: PlotParams) {
  return <Plot {...props} useResizeHandler style={{ width: "100%", height: "100%" }} />;
}