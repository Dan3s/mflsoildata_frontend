"use client";

import { useEffect, useRef } from "react";
import { driver, type Config, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

export type UploadTourStep = "metadata" | "plantilla" | "cargar" | "validacion";

type Side = "top" | "bottom" | "left" | "right";

/**
 * What each wizard step points at. `key` names the texts (`upload.tour.step.<key>`), `anchor` is
 * the `data-tour` attribute in UploadView. An anchor that is not on screen (the Dataverse shortcut
 * only exists for a new dataset, the issues list only when there are issues) is skipped.
 */
const TOURS: Record<UploadTourStep, { key: string; anchor: string; side: Side }[]> = {
  metadata: [
    { key: "modes", anchor: "up-modes", side: "bottom" },
    { key: "steps", anchor: "up-steps", side: "bottom" },
    { key: "target", anchor: "up-target", side: "bottom" },
    { key: "dataverse", anchor: "up-dataverse", side: "bottom" },
    { key: "form", anchor: "up-form", side: "top" },
    { key: "continue", anchor: "up-continue", side: "top" },
  ],
  plantilla: [
    { key: "skip", anchor: "up-skip", side: "bottom" },
    { key: "columns", anchor: "up-columns", side: "top" },
    { key: "download", anchor: "up-download", side: "top" },
  ],
  cargar: [
    { key: "dropzone", anchor: "up-dropzone", side: "bottom" },
    { key: "next", anchor: "up-next", side: "top" },
  ],
  validacion: [
    { key: "summary", anchor: "up-summary", side: "bottom" },
    { key: "issues", anchor: "up-issues", side: "top" },
    { key: "import", anchor: "up-import", side: "top" },
  ],
};

const seenKey = (step: UploadTourStep) => `mfl_upload_tour_${step}_seen`;

/** localStorage can be blocked (private window): the worst case is the tour replays. */
const hasSeen = (step: UploadTourStep) => {
  try {
    return localStorage.getItem(seenKey(step)) === "1";
  } catch {
    return false;
  }
};
const markSeen = (step: UploadTourStep) => {
  try {
    localStorage.setItem(seenKey(step), "1");
  } catch {
    /* a per-viewer convenience only */
  }
};

/** Forget that any step's tour was seen, so each plays again the next time it is reached. */
export const resetUploadTour = () => {
  for (const step of Object.keys(TOURS) as UploadTourStep[]) {
    try {
      localStorage.removeItem(seenKey(step));
    } catch {
      /* nothing to forget */
    }
  }
};

export type UploadTourCopy = {
  next: string;
  prev: string;
  done: string;
  close: string;
  /** Title and text of one stop, by its `key`. */
  text: (key: string) => { title: string; description: string };
};

const baseConfig: Config = {
  showProgress: true,
  // Driver.js's own template, not next-intl's: its {{double braces}} would trip ICU parsing.
  progressText: "{{current}} / {{total}}",
  allowClose: true,
  overlayOpacity: 0.55,
  stagePadding: 6,
  stageRadius: 10,
};

/**
 * A short walkthrough for each step of the upload wizard, shown once, the first time the person
 * reaches that step (so the form is explained when the form is in front of them, not all at the
 * start). `run` is bumped to play the current step again on demand, after `resetUploadTour()`.
 * Pass `step: null` where there is nothing to explain.
 *
 * A step counts as seen only if the person finishes or closes the tour: React re-mounting the
 * effect (StrictMode in development) or leaving the page half way does not.
 */
export function useUploadTour(step: UploadTourStep | null, run: number, copy: UploadTourCopy) {
  // The copy is a new object on every render; reading it through a ref keeps the effect from
  // restarting a tour that is in progress just because the page re-rendered.
  const copyRef = useRef(copy);
  copyRef.current = copy;

  useEffect(() => {
    if (!step || hasSeen(step)) return;

    let aborted = false;
    let instance: ReturnType<typeof driver> | null = null;

    // Give the step a moment to paint before measuring it.
    const timer = setTimeout(() => {
      const c = copyRef.current;
      const steps: DriveStep[] = TOURS[step]
        .filter((stop) => document.querySelector(`[data-tour="${stop.anchor}"]`))
        .map((stop) => ({
          element: `[data-tour="${stop.anchor}"]`,
          popover: { ...c.text(stop.key), side: stop.side, align: "start" },
        }));
      if (steps.length === 0) return;

      instance = driver({
        ...baseConfig,
        nextBtnText: c.next,
        prevBtnText: c.prev,
        doneBtnText: c.done,
        closeBtnLabel: c.close,
        steps,
        onDestroyed: () => {
          if (!aborted) markSeen(step);
        },
      });
      instance.drive();
    }, 500);

    return () => {
      aborted = true;
      clearTimeout(timer);
      instance?.destroy();
    };
  }, [step, run]);
}
