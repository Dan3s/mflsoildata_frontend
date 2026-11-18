"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver, type Config, type DriveStep } from "driver.js";
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
  prev: string;
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

const anchor = (name: string) => `[data-tour="${name}"]`;

/**
 * A short Driver.js walkthrough for the data explorer — the one view usability testing flagged
 * as the least self-explanatory (unfamiliar pivot-table UI). Split in two instead of one linear
 * tour: the filter steps run on mount, the canvas step runs the first time data actually loads,
 * since Graphic Walker itself doesn't mount until then. Each part plays once.
 *
 * `replay()` plays the whole thing again on demand, as one tour over whatever is on screen
 * (the caller opens the filters first). A part counts as seen only if the person finishes or
 * closes it: React re-mounting the effect (StrictMode in development) or leaving the page half
 * way does not, otherwise the tour would never show in development.
 */
export function useGraphicWalkerTour(copy: TourCopy, loaded: boolean) {
  const canvasTourShown = useRef(false);
  // Read through a ref so a re-render (a new `copy` object) never restarts a tour in progress.
  const copyRef = useRef(copy);
  copyRef.current = copy;
  const replayDriver = useRef<ReturnType<typeof driver> | null>(null);

  const labels = () => ({
    nextBtnText: copyRef.current.next,
    prevBtnText: copyRef.current.prev,
    doneBtnText: copyRef.current.done,
    closeBtnLabel: copyRef.current.close,
  });

  useEffect(() => {
    if (hasSeen(INTRO_SEEN_KEY)) return;
    let aborted = false;
    const c = copyRef.current;
    const d = driver({
      ...baseConfig,
      ...labels(),
      steps: [
        { element: anchor("gw-project"), popover: { title: c.project.title, description: c.project.description, side: "bottom", align: "start" } },
        { element: anchor("gw-variables"), popover: { title: c.variables.title, description: c.variables.description, side: "top", align: "start" } },
        { element: anchor("gw-load-button"), popover: { title: c.loadButton.title, description: c.loadButton.description, side: "right", align: "start" } },
      ],
      onDestroyed: () => {
        if (!aborted) markSeen(INTRO_SEEN_KEY);
      },
    });
    d.drive();
    return () => {
      aborted = true;
      d.destroy();
    };
  }, []);

  useEffect(() => {
    if (!loaded || canvasTourShown.current || hasSeen(CANVAS_SEEN_KEY)) return;
    // Graphic Walker mounts asynchronously after `loaded` flips — give its
    // canvas a moment to actually paint before highlighting it.
    const timer = setTimeout(() => {
      // Set here, not before the timer: `copy` is a new object on every render, so this
      // effect re-runs and cancels the timer; a flag set up front would then block the tour forever.
      canvasTourShown.current = true;
      const c = copyRef.current;
      const d = driver({
        ...baseConfig,
        ...labels(),
        steps: [{ element: anchor("gw-canvas"), popover: { title: c.canvas.title, description: c.canvas.description, side: "top", align: "center" } }],
        onDestroyed: () => markSeen(CANVAS_SEEN_KEY),
      });
      d.drive();
    }, 600);
    return () => clearTimeout(timer);
  }, [loaded]);

  const replay = useCallback(() => {
    replayDriver.current?.destroy();
    // Wait a beat: the caller has just opened the filters and they need to be laid out.
    setTimeout(() => {
      const c = copyRef.current;
      const stops: { name: string; title: string; description: string; side: "top" | "bottom" | "right"; align: "start" | "center" }[] = [
        { name: "gw-project", ...c.project, side: "bottom", align: "start" },
        { name: "gw-variables", ...c.variables, side: "top", align: "start" },
        { name: "gw-load-button", ...c.loadButton, side: "right", align: "start" },
        { name: "gw-canvas", ...c.canvas, side: "top", align: "center" },
      ];
      // Only what is on screen: before the data is loaded there is no canvas to point at.
      const steps: DriveStep[] = stops
        .filter((s) => document.querySelector(anchor(s.name)))
        .map((s) => ({ element: anchor(s.name), popover: { title: s.title, description: s.description, side: s.side, align: s.align } }));
      if (steps.length === 0) return;
      const d = driver({
        ...baseConfig,
        nextBtnText: c.next,
        prevBtnText: c.prev,
        doneBtnText: c.done,
        closeBtnLabel: c.close,
        steps,
        onDestroyed: () => {
          markSeen(INTRO_SEEN_KEY);
          if (steps.some((s) => s.element === anchor("gw-canvas"))) markSeen(CANVAS_SEEN_KEY);
        },
      });
      replayDriver.current = d;
      d.drive();
    }, 450);
  }, []);

  return { replay };
}
