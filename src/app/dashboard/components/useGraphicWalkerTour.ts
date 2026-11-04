"use client";

import { useEffect, useRef } from "react";
import { driver, type Config } from "driver.js";
import "driver.js/dist/driver.css";

const INTRO_SEEN_KEY = "mfl_gw_tour_intro_seen";
const CANVAS_SEEN_KEY = "mfl_gw_tour_canvas_seen";

/** Reads a localStorage flag, tolerating a private window / blocked storage —
 * worst case the tour just replays, which is harmless. */
const hasSeen = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const markSeen = (key: string) => {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* per-viewer convenience only — fine if it doesn't stick */
  }
};

type TourCopy = {
  project: { title: string; description: string };
  variables: { title: string; description: string };
  loadButton: { title: string; description: string };
  canvas: { title: string; description: string };
  next: string;
  done: string;
  close: string;
};

const baseConfig: Config = {
  showProgress: true,
  // Driver.js's own "{{current}} / {{total}}" template literal — not run
  // through next-intl, since its {{double braces}} would trip up ICU parsing.
  progressText: "{{current}} / {{total}}",
  allowClose: true,
  overlayOpacity: 0.55,
  stagePadding: 6,
  stageRadius: 10,
};

/**
 * A short, one-time Driver.js walkthrough for the data explorer — the one view
 * usability testing flagged as the least self-explanatory (unfamiliar
 * pivot-table UI). Split in two instead of one linear tour: the filter steps
 * run on mount, the canvas step runs the first time data actually loads,
 * since Graphic Walker itself doesn't mount until then.
 */
export function useGraphicWalkerTour(copy: TourCopy, loaded: boolean) {
  const canvasTourShown = useRef(false);

  useEffect(() => {
    if (hasSeen(INTRO_SEEN_KEY)) return;
    const d = driver({
      ...baseConfig,
      nextBtnText: copy.next,
      doneBtnText: copy.done,
      closeBtnLabel: copy.close,
      steps: [
        { element: '[data-tour="gw-project"]', popover: { title: copy.project.title, description: copy.project.description, side: "bottom", align: "start" } },
        { element: '[data-tour="gw-variables"]', popover: { title: copy.variables.title, description: copy.variables.description, side: "top", align: "start" } },
        { element: '[data-tour="gw-load-button"]', popover: { title: copy.loadButton.title, description: copy.loadButton.description, side: "right", align: "start" } },
      ],
      onDestroyed: () => markSeen(INTRO_SEEN_KEY),
    });
    d.drive();
    return () => d.destroy();
    // Runs once on mount — re-running on every copy/locale change would restart
    // an in-progress tour, which is worse than a stale label mid-tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded || canvasTourShown.current || hasSeen(CANVAS_SEEN_KEY)) return;
    // Graphic Walker mounts asynchronously after `loaded` flips — give its
    // canvas a moment to actually paint before highlighting it.
    const timer = setTimeout(() => {
      // Set here, not before the timer: `copy` is a new object on every render, so this
      // effect re-runs and cancels the timer; a flag set up front would then block the tour forever.
      canvasTourShown.current = true;
      const d = driver({
        ...baseConfig,
        nextBtnText: copy.next,
        doneBtnText: copy.done,
        closeBtnLabel: copy.close,
        steps: [
          { element: '[data-tour="gw-canvas"]', popover: { title: copy.canvas.title, description: copy.canvas.description, side: "top", align: "center" } },
        ],
        onDestroyed: () => markSeen(CANVAS_SEEN_KEY),
      });
      d.drive();
    }, 600);
    return () => clearTimeout(timer);
  }, [loaded, copy]);
}
