"use client";

import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import type { PlotParams } from "react-plotly.js";

const Plot = createPlotlyComponent(Plotly);

export default function PlotlyFigure(props: PlotParams) {
  return <Plot {...props} useResizeHandler style={{ width: "100%", height: "100%" }} />;
}