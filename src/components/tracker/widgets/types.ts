/** Shared types for week widgets */
export interface WidgetProps {
  days: Date[];
  /** Map key: "YYYY-MM-DD|HH" → cell data */
  data: Map<string, { id?: string; activityName?: string }>;
  colorMap: Record<string, string>;
  ratings?: Map<string, number>;
}

/** Hex colors for SVG rendering, keyed by activity color name. */
export const COLOR_HEX: Record<string, string> = {
  teal: "#2dd4bf", sky: "#38bdf8", blue: "#3b82f6",
  slate: "#475569", indigo: "#818cf8", emerald: "#34d399",
  pink: "#f472b6", lime: "#a3e635", green: "#4ade80",
  yellow: "#facc15", olive: "#15803d", violet: "#a78bfa",
  purple: "#7c3aed", rose: "#fb7185", fuchsia: "#e879f9",
  cyan: "#22d3ee", orange: "#fb923c", blush: "#fbcfe8",
  amber: "#fbbf24",
};

export const RATING_COLORS: Record<number, string> = {
  1: "#fb923c", 2: "#facc15", 3: "#a3e635", 4: "#34d399", 5: "#3b82f6",
};

export const RATING_LABELS: Record<number, string> = {
  1: "Bad", 2: "Meh", 3: "Okay", 4: "Awesome", 5: "LifeMax",
};
