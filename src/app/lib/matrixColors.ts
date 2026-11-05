/** The five sample matrices the app works with, in the order they should appear in pickers. */
export const MATRIX_OPTIONS = ["SOIL", "LEAF", "GRAIN", "SOIL_PROFILE", "SOIL_HORIZON"] as const;

export type MatrixOption = (typeof MATRIX_OPTIONS)[number];

/**
 * One color per matrix, reused everywhere a matrix value is shown (badges, chips,
 * legends). Chosen to stay visually distinct from ACCESS_BADGE/QC_BADGE in
 * DatasetCatalogue.tsx (brand/amber/gray/orange/blue/red), so the two badge
 * families never look alike when they appear side by side on the same card.
 */
const MATRIX_BADGE: Record<string, string> = {
  SOIL: "bg-earth-100 text-earth-800",
  LEAF: "bg-teal-100 text-teal-800",
  GRAIN: "bg-yellow-100 text-yellow-800",
  SOIL_PROFILE: "bg-purple-100 text-purple-800",
  SOIL_HORIZON: "bg-rose-100 text-rose-800",
};

/** Flat gray, matching the app's previous plain matrix badge, for any value outside the 5 known ones. */
const MATRIX_BADGE_DEFAULT = "bg-gray-100 text-gray-600";

/** Tailwind classes for a matrix badge/chip, with a safe fallback for free-text matrix values. */
export const matrixBadgeClass = (matrix?: string | null): string => {
  if (!matrix) return MATRIX_BADGE_DEFAULT;
  return MATRIX_BADGE[matrix] ?? MATRIX_BADGE_DEFAULT;
};
