"use client";

import type { FilterOption, VariableRead } from "@/app/services";
import GraphicWalkerView from "./GraphicWalkerView";

type Props = {
  projectOptions: FilterOption[];
  variables: VariableRead[];
  initialProjectId?: string;
  initialSiteId?: string;
  initialSiteCode?: string;
  initialVariableId?: string;
  initialMatrix?: string;
  initialInstitution?: string;
};

/**
 * Visualization section.
 *
 * Only the Graphic Walker explorer is exposed for now — the fixed chart views
 * (`VisualizationView`) are hidden rather than deleted, so they can come back
 * without rebuilding them. With a single mode there is no toggle to render, and
 * the explorer takes the full height it needs to be usable.
 */
export default function VisualizationSection(props: Props) {
  return (
    <div className="h-full">
      <GraphicWalkerView
        projectOptions={props.projectOptions}
        variables={props.variables}
        initialInstitution={props.initialInstitution}
        initialProjectId={props.initialProjectId}
        initialSiteId={props.initialSiteId}
        initialSiteCode={props.initialSiteCode}
        initialVariableId={props.initialVariableId}
        initialMatrix={props.initialMatrix}
      />
    </div>
  );
}
