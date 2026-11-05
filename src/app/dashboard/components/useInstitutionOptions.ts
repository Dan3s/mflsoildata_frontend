"use client";

import { useEffect, useState } from "react";
import { dashboardService } from "@/app/services";
import type { FilterOption } from "@/app/services";

/**
 * Institutions that own data, for the "filter by institution" selects.
 *
 * Fetched client-side so each filter surface can opt in on its own, without
 * threading another prop through the three server pages that render them.
 * Failure is silent: the select simply offers no options and the rest of the
 * filters keep working.
 */
export function useInstitutionOptions(): FilterOption[] {
  const [options, setOptions] = useState<FilterOption[]>([]);

  useEffect(() => {
    let active = true;
    dashboardService
      .getInstitutionOptions()
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch(() => {
        if (active) setOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return options;
}
