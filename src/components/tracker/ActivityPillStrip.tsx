"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { getActivityDotClass } from "@/lib/activities";
import { cn } from "@/lib/utils";
import { COLOR_HEX } from "./widgets/types";
import { FilterPill } from "./FilterPill";

const PILL_GAP_PX = 6;

export interface ActivityPillItem {
  name: string;
  colorKey: string;
  activeHex?: string;
}

interface ActivityPillStripProps {
  items: ActivityPillItem[];
  active: string | null;
  onSelect: (activity: string | null) => void;
}

interface PillStripLayout {
  splitIndex: number | null;
  allowHorizontalScroll: boolean;
}

function getRowWidth(widths: number[], start: number, end: number) {
  if (end <= start) return 0;

  let width = 0;
  for (let index = start; index < end; index++) {
    width += widths[index];
  }

  return width + PILL_GAP_PX * Math.max(0, end - start - 1);
}

export function ActivityPillStrip({ items, active, onSelect }: ActivityPillStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PillStripLayout>({ splitIndex: null, allowHorizontalScroll: false });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const updateLayout = () => {
      const containerWidth = container.clientWidth;
      const pillWidths = Array.from(measure.querySelectorAll<HTMLElement>("[data-pill-measure='true']")).map((element) => element.offsetWidth);
      const totalWidth = getRowWidth(pillWidths, 0, pillWidths.length);

      if (totalWidth <= containerWidth) {
        setLayout((prev) => (
          prev.splitIndex === null && !prev.allowHorizontalScroll
            ? prev
            : { splitIndex: null, allowHorizontalScroll: false }
        ));
        return;
      }

      let greedySplit = pillWidths.length;
      for (let index = 1; index <= pillWidths.length; index++) {
        if (getRowWidth(pillWidths, 0, index) > containerWidth) {
          greedySplit = Math.max(1, index - 1);
          break;
        }
      }

      if (greedySplit < pillWidths.length && getRowWidth(pillWidths, greedySplit, pillWidths.length) <= containerWidth) {
        setLayout((prev) => (
          prev.splitIndex === greedySplit && !prev.allowHorizontalScroll
            ? prev
            : { splitIndex: greedySplit, allowHorizontalScroll: false }
        ));
        return;
      }

      let bestSplit = 1;
      let bestScore = Number.POSITIVE_INFINITY;

      for (let index = 1; index < pillWidths.length; index++) {
        const row1Width = getRowWidth(pillWidths, 0, index);
        const row2Width = getRowWidth(pillWidths, index, pillWidths.length);
        const overflow = Math.max(0, row1Width - containerWidth) + Math.max(0, row2Width - containerWidth);
        const imbalance = Math.abs(row1Width - row2Width);
        const score = overflow * 10_000 + imbalance;

        if (score < bestScore) {
          bestScore = score;
          bestSplit = index;
        }
      }

      const row1Width = getRowWidth(pillWidths, 0, bestSplit);
      const row2Width = getRowWidth(pillWidths, bestSplit, pillWidths.length);
      const allowHorizontalScroll = row1Width > containerWidth || row2Width > containerWidth;

      setLayout((prev) => (
        prev.splitIndex === bestSplit && prev.allowHorizontalScroll === allowHorizontalScroll
          ? prev
          : { splitIndex: bestSplit, allowHorizontalScroll }
      ));
    };

    updateLayout();

    const observer = new ResizeObserver(() => updateLayout());
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [items]);

  const useSingleRow = layout.splitIndex === null;
  const splitIndex = layout.splitIndex ?? items.length;
  const firstRow = useSingleRow ? items : items.slice(0, splitIndex);
  const secondRow = useSingleRow ? [] : items.slice(splitIndex);

  return (
    <div ref={containerRef} className={cn("min-w-0 flex-1 pr-1", (useSingleRow || layout.allowHorizontalScroll) && "overflow-x-auto")}>
      <div ref={measureRef} className="absolute invisible pointer-events-none whitespace-nowrap">
        <div className="flex items-center gap-1.5 w-max py-1">
          {items.map((item) => (
            <div key={item.name} data-pill-measure="true">
              <FilterPill
                label={item.name}
                dotClass={getActivityDotClass(item.colorKey)}
                activeHex={item.activeHex ?? COLOR_HEX[item.colorKey]}
                active={false}
                onClick={() => {}}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={cn("py-1", useSingleRow ? "flex w-max items-center gap-1.5" : "flex min-w-full flex-col gap-1.5") }>
        <div className="flex w-max items-center gap-1.5">
          {firstRow.map((item) => (
            <FilterPill
              key={item.name}
              label={item.name}
              dotClass={getActivityDotClass(item.colorKey)}
              activeHex={item.activeHex ?? COLOR_HEX[item.colorKey]}
              active={active === item.name}
              onClick={() => onSelect(active === item.name ? null : item.name)}
            />
          ))}
        </div>

        {secondRow.length > 0 && (
          <div className="flex w-max items-center gap-1.5">
            {secondRow.map((item) => (
              <FilterPill
                key={item.name}
                label={item.name}
                dotClass={getActivityDotClass(item.colorKey)}
                activeHex={item.activeHex ?? COLOR_HEX[item.colorKey]}
                active={active === item.name}
                onClick={() => onSelect(active === item.name ? null : item.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}