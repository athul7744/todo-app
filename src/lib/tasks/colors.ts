export const TAG_COLORS = [
  "amber",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "lime",
  "zinc",
  "stone"
];

export const getTagColorClasses = (baseColor: string) => {
  const colorMap: Record<string, string> = {
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700",
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-700",
    cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-800 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-700",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-700",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-700",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700",
    fuchsia: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-800 dark:text-fuchsia-200 border border-fuchsia-200 dark:border-fuchsia-700",
    pink: "bg-pink-100 text-pink-700 dark:bg-pink-800 dark:text-pink-200 border border-pink-200 dark:border-pink-700",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-700",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
    lime: "bg-lime-100 text-lime-700 dark:bg-lime-800 dark:text-lime-200 border border-lime-200 dark:border-lime-700",
    zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700",
    stone: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700",
  };

  return colorMap[baseColor] || colorMap['slate'];
};

export const getTagDotClass = (baseColor: string) => {
  const dotMap: Record<string, string> = {
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    teal: "bg-teal-500",
    cyan: "bg-cyan-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
    purple: "bg-purple-500",
    fuchsia: "bg-fuchsia-500",
    pink: "bg-pink-500",
    rose: "bg-rose-500",
    slate: "bg-slate-500",
    lime: "bg-lime-500",
    zinc: "bg-zinc-500",
    stone: "bg-stone-500",
  };
  return dotMap[baseColor] || dotMap['slate'];
}