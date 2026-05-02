/** Available colors for activity types (subset used by the tracker). */
export const ACTIVITY_COLORS = [
  "teal",
  "indigo",
  "orange",
  "lime",
  "fuchsia",
  "sky",
  "amber",
  "rose",
  "cyan",
  "violet",
] as const;

export type ActivityColor = (typeof ACTIVITY_COLORS)[number];

/** Default activities seeded when the user has none yet. */
export const DEFAULT_ACTIVITIES: { name: string; color: ActivityColor }[] = [
  { name: "Coding",    color: "teal"    },
  { name: "Deep Work", color: "indigo"  },
  { name: "Meetings",  color: "orange"  },
  { name: "Exercise",  color: "lime"    },
  { name: "Admin",     color: "fuchsia" },
];

/**
 * Cell background classes keyed by activity color.
 * Each entry provides light + dark mode bg/text for grid cells.
 */
export const ACTIVITY_CELL_CLASSES: Record<string, string> = {
  teal:    "bg-teal-400/80 dark:bg-teal-600/70 text-teal-950 dark:text-teal-100",
  indigo:  "bg-indigo-400/80 dark:bg-indigo-600/70 text-indigo-950 dark:text-indigo-100",
  orange:  "bg-orange-400/80 dark:bg-orange-600/70 text-orange-950 dark:text-orange-100",
  lime:    "bg-lime-400/80 dark:bg-lime-600/70 text-lime-950 dark:text-lime-100",
  fuchsia: "bg-fuchsia-400/80 dark:bg-fuchsia-600/70 text-fuchsia-950 dark:text-fuchsia-100",
  sky:     "bg-sky-400/80 dark:bg-sky-600/70 text-sky-950 dark:text-sky-100",
  amber:   "bg-amber-400/80 dark:bg-amber-600/70 text-amber-950 dark:text-amber-100",
  rose:    "bg-rose-400/80 dark:bg-rose-600/70 text-rose-950 dark:text-rose-100",
  cyan:    "bg-cyan-400/80 dark:bg-cyan-600/70 text-cyan-950 dark:text-cyan-100",
  violet:  "bg-violet-400/80 dark:bg-violet-600/70 text-violet-950 dark:text-violet-100",
};

/** Toolbar button classes (stronger fill for the selected state). */
export const ACTIVITY_BUTTON_CLASSES: Record<string, { base: string; active: string }> = {
  teal:    { base: "border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300",       active: "bg-teal-500 text-white border-teal-500 dark:bg-teal-600 dark:border-teal-600" },
  indigo:  { base: "border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300", active: "bg-indigo-500 text-white border-indigo-500 dark:bg-indigo-600 dark:border-indigo-600" },
  orange:  { base: "border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300", active: "bg-orange-500 text-white border-orange-500 dark:bg-orange-600 dark:border-orange-600" },
  lime:    { base: "border-lime-300 dark:border-lime-700 text-lime-700 dark:text-lime-300",         active: "bg-lime-500 text-white border-lime-500 dark:bg-lime-600 dark:border-lime-600" },
  fuchsia: { base: "border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-700 dark:text-fuchsia-300", active: "bg-fuchsia-500 text-white border-fuchsia-500 dark:bg-fuchsia-600 dark:border-fuchsia-600" },
  sky:     { base: "border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300",             active: "bg-sky-500 text-white border-sky-500 dark:bg-sky-600 dark:border-sky-600" },
  amber:   { base: "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300",     active: "bg-amber-500 text-white border-amber-500 dark:bg-amber-600 dark:border-amber-600" },
  rose:    { base: "border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300",         active: "bg-rose-500 text-white border-rose-500 dark:bg-rose-600 dark:border-rose-600" },
  cyan:    { base: "border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300",         active: "bg-cyan-500 text-white border-cyan-500 dark:bg-cyan-600 dark:border-cyan-600" },
  violet:  { base: "border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300", active: "bg-violet-500 text-white border-violet-500 dark:bg-violet-600 dark:border-violet-600" },
};

/** Dot class for the color picker (matches getTagDotClass pattern). */
export const getActivityDotClass = (color: string): string => {
  const dotMap: Record<string, string> = {
    teal: "bg-teal-500", indigo: "bg-indigo-500", orange: "bg-orange-500",
    lime: "bg-lime-500", fuchsia: "bg-fuchsia-500", sky: "bg-sky-500",
    amber: "bg-amber-500", rose: "bg-rose-500", cyan: "bg-cyan-500",
    violet: "bg-violet-500",
  };
  return dotMap[color] || "bg-slate-500";
};
