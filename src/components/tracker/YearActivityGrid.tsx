"use client";

import { useQuery } from "@powersync/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, startOfYear, endOfYear, eachDayOfInterval, getMonth, isEqual, startOfDay } from "date-fns";
import { Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActivityDotClass } from "@/lib/activities";
import { TimeLog, ActivityType } from "@/lib/powersync/AppSchema";
import { COLOR_HEX } from "./widgets/types";
import { FilterPill } from "./FilterPill";
import { DayPopover } from "./DayPopover";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Canvas grid constants
const LABEL_COL_WIDTH = 44;
const HEADER_HEIGHT = 22;
const BORDER_RADIUS = 4;
const MIN_CELL_SIZE = 12;
const CELL_GAP = 3;

interface YearActivityGridProps {
  year: number;
  onDayClick?: (date: Date) => void;
  /** Optional element rendered to the left of the activity filter toolbar */
  headerLeft?: React.ReactNode;
}

export function YearActivityGrid({ year, onDayClick, headerLeft }: YearActivityGridProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!selectedDay) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectedDay(null);
        setPopoverPos(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedDay]);

  const yearStart = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd'T'00:00:00'+00:00'");
  const yearEnd = format(endOfYear(new Date(year, 0, 1)), "yyyy-MM-dd'T'23:59:59'+00:00'");

  const { data: activityTypes, isLoading: loadingTypes } = useQuery<ActivityType & { id: string }>(
    "SELECT * FROM activity_types ORDER BY created_at ASC"
  );

  const { data: logs, isLoading: loadingLogs } = useQuery<TimeLog & { id: string }>(
    `SELECT activity_name, start_timestamp FROM time_logs
     WHERE start_timestamp >= ? AND start_timestamp <= ?
     ORDER BY start_timestamp ASC`,
    [yearStart, yearEnd]
  );

  const colorMap = useMemo(
    () => Object.fromEntries(activityTypes.map((a) => [a.name, a.color ?? "teal"])),
    [activityTypes]
  );

  const cellMap = useMemo(() => {
    const map = new Map<string, { color: string; activity: string }>();
    for (const log of logs) {
      const ts = new Date(log.start_timestamp!);
      const dateKey = ts.toISOString().slice(0, 10);
      const hourKey = String(ts.getUTCHours()).padStart(2, "0");
      const color = colorMap[log.activity_name ?? ""] ?? "teal";
      map.set(`${dateKey}|${hourKey}`, { color, activity: log.activity_name ?? "" });
    }
    return map;
  }, [logs, colorMap]);

  const allDays = useMemo(
    () => eachDayOfInterval({ start: startOfYear(new Date(year, 0, 1)), end: endOfYear(new Date(year, 0, 1)) }),
    [year]
  );

  // Build legend: unique activities that appear in data
  const legend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const { activity, color } of cellMap.values()) {
      if (activity && !seen.has(activity)) seen.set(activity, color);
    }
    return Array.from(seen.entries()).map(([name, colorKey]) => ({ name, colorKey, hex: COLOR_HEX[colorKey] || "#6b7280" }));
  }, [cellMap]);

  // Day summary for selected day
  const daySummary = useMemo(() => {
    if (!selectedDay) return null;
    const dateKey = format(selectedDay, "yyyy-MM-dd");
    const activities: Record<string, { count: number; hex: string }> = {};
    for (let h = 0; h < 24; h++) {
      const key = `${dateKey}|${String(h).padStart(2, "0")}`;
      const cell = cellMap.get(key);
      if (cell) {
        if (!activities[cell.activity]) {
          activities[cell.activity] = { count: 0, hex: COLOR_HEX[cell.color] || "#6b7280" };
        }
        activities[cell.activity].count++;
      }
    }
    const totalHours = Object.values(activities).reduce((s, a) => s + a.count, 0);
    return { dateKey, totalHours, activities };
  }, [selectedDay, cellMap]);

  if (loadingTypes || loadingLogs) {
    return (
      <div className="space-y-3">
        {/* Header skeleton: year selector + activity pills */}
        <div className="flex items-start gap-3">
          {headerLeft}
          <div className="overflow-x-auto flex-1">
            <div className="flex flex-col gap-1.5 py-1">
              <div className="flex items-center gap-1.5 w-max">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-6 w-20 rounded-full bg-muted animate-pulse" />
                ))}
              </div>
              <div className="flex items-center gap-1.5 w-max">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-6 w-18 rounded-full bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="rounded-xl border border-border bg-card overflow-hidden flex-1">
          <div className="overflow-x-auto overflow-y-hidden h-[calc(100vh-220px)] p-1">
            <table className="border-separate border-spacing-[1px] text-[10px] w-full table-fixed h-full">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-card px-1 py-1.5 w-[40px]">
                    <div className="h-2.5 w-7 bg-muted rounded animate-pulse" />
                  </th>
                  {HOURS.map((h) => (
                    <th key={h} className="px-0 py-1.5 text-center font-medium text-muted-foreground/60 w-[14px]">
                      {h % 6 === 0 ? String(h).padStart(2, "0") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 50 }).map((_, row) => (
                  <tr key={row}>
                    <td className="sticky left-0 z-10 bg-card px-1 py-0 w-[40px]">
                      <div className="h-2.5 w-8 bg-muted rounded animate-pulse" />
                    </td>
                    {HOURS.map((_, h) => (
                      <td key={h} className="p-0">
                        <div className={cn(
                          "h-[12px] w-[12px] rounded-[3px]",
                          ((row * 24 + h) * 13 + row) % 6 === 0 ? "bg-muted animate-pulse" : "bg-muted/30"
                        )} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Grid3X3 className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No activity data for {year}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Activity filter toolbar - two rows like week view, with headerLeft */}
      <div className="flex items-start gap-3">
        {headerLeft}
        <div className="overflow-x-auto flex-1">
          <div className="flex flex-col gap-1.5 py-1">
            {[legend.slice(0, Math.ceil(legend.length / 2)), legend.slice(Math.ceil(legend.length / 2))].map((row, rowIdx) => (
              <div key={rowIdx} className="flex items-center gap-1.5 w-max">
                {row.map((item) => (
                  <FilterPill
                    key={item.name}
                    label={item.name}
                    dotClass={getActivityDotClass(item.colorKey)}
                    activeHex={item.hex}
                    active={activeFilter === item.name}
                    onClick={() => setActiveFilter(activeFilter === item.name ? null : item.name)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day popover */}
      {daySummary && selectedDay && popoverPos && (
        <DayPopover
          ref={popoverRef}
          day={selectedDay}
          position={popoverPos}
          activities={Object.entries(daySummary.activities)
            .sort(([, a], [, b]) => b.count - a.count)
            .map(([name, { count, hex }]) => ({ name, count, hex }))}
          totalHours={daySummary.totalHours}
          showBars
          onClose={() => { setSelectedDay(null); setPopoverPos(null); }}
          onEditDay={() => { onDayClick?.(selectedDay); setSelectedDay(null); setPopoverPos(null); }}
        />
      )}

      {/* Canvas Grid */}
      <ActivityCanvas
        allDays={allDays}
        cellMap={cellMap}
        activeFilter={activeFilter}
        selectedDay={selectedDay}
        onDaySelect={(day, e) => {
          setSelectedDay((prev) => {
            const isSelected = prev && isEqual(startOfDay(day), startOfDay(prev));
            if (isSelected) {
              setPopoverPos(null);
              return null;
            }
            const x = Math.min(e.clientX + 8, window.innerWidth - 256);
            const y = Math.min(e.clientY - 20, window.innerHeight - 260);
            setPopoverPos({ x: Math.max(8, x), y: Math.max(8, y) });
            return day;
          });
        }}
      />
    </div>
  );
}

/** Canvas-based activity grid — renders 8,760 cells as pixels for smooth scroll/filter */
function ActivityCanvas({ allDays, cellMap, activeFilter, selectedDay, onDaySelect }: {
  allDays: Date[];
  cellMap: Map<string, { activity: string; color: string }>;
  activeFilter: string | null;
  selectedDay: Date | null;
  onDaySelect: (day: Date, e: React.MouseEvent) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const hoveredRowRef = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const needsRedrawRef = useRef(false);

  // Measure the outer wrapper to determine available width
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute cell size to fill the width (use available space minus labels)
  const availableWidth = Math.max(0, containerWidth - LABEL_COL_WIDTH - 2); // 2px for border
  const cellStride = availableWidth > 0 ? availableWidth / 24 : MIN_CELL_SIZE + CELL_GAP;
  const cellSize = Math.max(1, cellStride - CELL_GAP);
  const gridWidth = Math.round(24 * cellStride);
  const gridHeight = Math.round(allDays.length * cellStride);

  // Resolve theme colors (cached, only recomputes when grid dimensions change)
  const themeColors = useMemo(() => {
    if (typeof document === "undefined") return { fgHighlight: "transparent", fgHover: "transparent", mutedBg: "transparent" };
    const tempEl = document.createElement("div");
    tempEl.style.position = "absolute";
    tempEl.style.visibility = "hidden";
    tempEl.style.pointerEvents = "none";
    document.body.appendChild(tempEl);
    const getColor = (varName: string, opacity = 1) => {
      tempEl.style.color = `var(${varName})`;
      const computed = getComputedStyle(tempEl).color;
      if (opacity >= 1) return computed;
      tempEl.style.color = `color-mix(in srgb, var(${varName}) ${Math.round(opacity * 100)}%, transparent)`;
      return getComputedStyle(tempEl).color;
    };
    const colors = {
      fgHighlight: getColor("--foreground", 0.08),
      fgHover: getColor("--foreground", 0.04),
      mutedBg: getColor("--muted-foreground", 0.15),
    };
    document.body.removeChild(tempEl);
    return colors;
  }, [containerWidth]); // recompute on resize (theme may change with breakpoints)

  // Draw the canvas (cells only, no labels)
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(gridWidth * dpr);
    const targetH = Math.round(gridHeight * dpr);
    // Only reset dimensions if they changed (resizing clears canvas)
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, gridWidth, gridHeight);

    const { fgHighlight, fgHover, mutedBg } = themeColors;

    const selectedDateKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
    const hoveredRow = hoveredRowRef.current;

    for (let row = 0; row < allDays.length; row++) {
      const day = allDays[row];
      const dateKey = format(day, "yyyy-MM-dd");
      const y = row * cellStride;
      const isSelected = dateKey === selectedDateKey;
      const isHovered = row === hoveredRow;

      // Row highlight
      if (isSelected || isHovered) {
        ctx.fillStyle = isSelected ? fgHighlight : fgHover;
        ctx.fillRect(0, y, gridWidth, cellStride);
      }

      // Cells
      for (let h = 0; h < 24; h++) {
        const key = `${dateKey}|${String(h).padStart(2, "0")}`;
        const cell = cellMap.get(key);
        const x = h * cellStride;
        const hex = cell ? COLOR_HEX[cell.color] || "#6b7280" : undefined;

        if (!hex) {
          ctx.globalAlpha = activeFilter ? 0.05 : 0.1;
          ctx.fillStyle = mutedBg;
          roundRect(ctx, x, y, cellSize, cellSize, BORDER_RADIUS);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          let targetAlpha = 1;
          if (activeFilter) {
            targetAlpha = cell!.activity === activeFilter ? 1 : 0.15;
          }
          ctx.globalAlpha = targetAlpha;
          ctx.fillStyle = hex;
          roundRect(ctx, x, y, cellSize, cellSize, BORDER_RADIUS);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  }, [allDays, cellMap, activeFilter, selectedDay, gridWidth, gridHeight, cellSize, cellStride, themeColors]);

  // Redraw immediately when inputs change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Redraw on hover change without triggering React state churn
  const scheduleHoverRedraw = useCallback(() => {
    if (needsRedrawRef.current) return;
    needsRedrawRef.current = true;
    requestAnimationFrame(() => {
      needsRedrawRef.current = false;
      drawCanvas();
    });
  }, [drawCanvas]);

  // Hit detection on canvas (coords relative to canvas, not container)
  const getCell = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = gridWidth / rect.width;
    const scaleY = gridHeight / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const row = Math.floor(y / cellStride);
    const col = Math.floor(x / cellStride);

    if (row < 0 || row >= allDays.length || col < 0 || col >= 24) return null;
    return { row, col };
  }, [allDays.length, gridWidth, gridHeight, cellStride]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const hit = getCell(e);
    if (!hit) {
      setTooltip(null);
      if (hoveredRowRef.current !== null) {
        hoveredRowRef.current = null;
        scheduleHoverRedraw();
      }
      return;
    }
    if (hoveredRowRef.current !== hit.row) {
      hoveredRowRef.current = hit.row;
      scheduleHoverRedraw();
    }
    const day = allDays[hit.row];
    const dateKey = format(day, "yyyy-MM-dd");
    const key = `${dateKey}|${String(hit.col).padStart(2, "0")}`;
    const cell = cellMap.get(key);
    if (cell) {
      const rect = canvasRef.current!.getBoundingClientRect();
      setTooltip({
        text: `${cell.activity} · ${format(day, "MMM d")} ${String(hit.col).padStart(2, "0")}:00`,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 28,
      });
    } else {
      setTooltip(null);
    }
  }, [allDays, cellMap, getCell, scheduleHoverRedraw]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const hit = getCell(e);
    if (!hit) return;
    onDaySelect(allDays[hit.row], e);
  }, [allDays, getCell, onDaySelect]);

  const selectedDateKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;

  return (
    <div ref={wrapperRef} className="rounded-xl border border-border bg-card" style={{ overflow: "clip" }}>
      <div
        className="overflow-auto max-h-[calc(100vh-260px)] relative"
        onMouseLeave={() => { setTooltip(null); hoveredRowRef.current = null; scheduleHoverRedraw(); }}
      >
        <table className="border-separate border-spacing-0 text-[10px]" style={{ width: LABEL_COL_WIDTH + gridWidth }}>
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-card" style={{ width: LABEL_COL_WIDTH, height: HEADER_HEIGHT }} />
              {HOURS.map((h) => (
                <th
                  key={h}
                  className="sticky top-0 z-20 bg-card text-center font-bold text-muted-foreground/60 px-0"
                  style={{ width: cellStride, height: HEADER_HEIGHT }}
                >
                  {h % 6 === 0 ? String(h).padStart(2, "0") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const isFirstOfMonth = day.getDate() === 1;
              const isSelected = dateKey === selectedDateKey;
              return (
                <tr key={dateKey} style={{ height: cellStride }}>
                  <td
                    className={cn(
                      "sticky left-0 bg-card px-1 whitespace-nowrap",
                      isFirstOfMonth ? "top-0 z-20 text-foreground font-bold" : "z-10 text-muted-foreground/60 text-[9px]",
                      isSelected && "text-foreground font-bold"
                    )}
                    style={isFirstOfMonth ? { top: HEADER_HEIGHT, width: LABEL_COL_WIDTH } : { width: LABEL_COL_WIDTH }}
                  >
                    {isFirstOfMonth ? MONTH_NAMES[getMonth(day)] : String(day.getDate())}
                  </td>
                  <td colSpan={24} className="p-0 h-0" />
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Canvas overlaid on cell area */}
        <canvas
          ref={canvasRef}
          className="absolute cursor-pointer"
          style={{ top: HEADER_HEIGHT, left: LABEL_COL_WIDTH, width: gridWidth, height: gridHeight }}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none px-2 py-1 rounded bg-popover border border-border text-[10px] text-foreground shadow-md whitespace-nowrap z-50"
            style={{ left: LABEL_COL_WIDTH + tooltip.x, top: HEADER_HEIGHT + tooltip.y, transform: "translateX(-50%)" }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
}

/** Draw a rounded rectangle path */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
