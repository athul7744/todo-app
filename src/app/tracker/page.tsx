"use client";

import { usePowerSync, useQuery } from "@powersync/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, getYear } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { Timer, CalendarDays, Activity, Smile, Calendar } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ActivityToolbar } from "@/components/tracker/ActivityToolbar";
import { TimeGrid, GridData, GridCell } from "@/components/tracker/TimeGrid";
import { ManageActivitiesDialog } from "@/components/tracker/ManageActivitiesDialog";
import { WeekNavigator } from "@/components/tracker/WeekNavigator";
import { WeekWidgets } from "@/components/tracker/widgets";
import { WeekViewSkeleton } from "@/components/tracker/WeekViewSkeleton";
import { YearActivityGrid } from "@/components/tracker/YearActivityGrid";
import { YearRatingGrid } from "@/components/tracker/YearRatingGrid";
import { TimeLog, ActivityType, DailyRating } from "@/lib/powersync/AppSchema";
import { getCurrentUserId } from "@/lib/auth";
import { getApp } from "@/lib/apps";
import { DEFAULT_ACTIVITIES } from "@/lib/activities";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const trackerApp = getApp("tracker");

type ViewMode = "week" | "activity" | "mood";

export default function TrackerPage() {
  const db = usePowerSync();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeActivity, setActiveActivity] = useState<string | null>(null);
  const view = (searchParams.get("view") as ViewMode) || "week";
  const setView = (v: ViewMode) => router.push(`/tracker?view=${v}`, { scroll: false });
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedYear, setSelectedYear] = useState(() => getYear(new Date()));
  const seededRef = useRef(false);
  const hasLoadedOnce = useRef(false);

  // Query activity types from local DB
  const { data: activityTypes, isLoading: loadingActivities } = useQuery<ActivityType & { id: string }>(
    "SELECT * FROM activity_types ORDER BY created_at ASC"
  );

  // Seed defaults on first load if the user has no activity types
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    (async () => {
      const existing = await db.getAll("SELECT id FROM activity_types LIMIT 1");
      if (existing.length > 0) return;

      const userId = await getCurrentUserId();
      for (const a of DEFAULT_ACTIVITIES) {
        await db.execute(
          `INSERT INTO activity_types (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
          [uuidv4(), userId, a.name, a.color]
        );
      }
    })();
  }, [db]);

  // Build a name→color map from the DB rows
  const activityColorMap = useMemo(
    () => Object.fromEntries(activityTypes.map((a) => [a.name, a.color ?? "teal"])),
    [activityTypes]
  );

  // Build the 7-day window based on selected week (Mon–Sun)
  const days = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const rangeStart = format(days[0], "yyyy-MM-dd'T'00:00:00'+00:00'");
  const rangeEnd = format(days[days.length - 1], "yyyy-MM-dd'T'23:59:59'+00:00'");

  // Subscribe to time_logs within the week window
  const { data: logs, isLoading: loadingLogs } = useQuery<TimeLog & { id: string }>(
    `SELECT id, activity_name, start_timestamp, duration_minutes
     FROM time_logs
     WHERE start_timestamp >= ? AND start_timestamp <= ?
     ORDER BY start_timestamp ASC`,
    [rangeStart, rangeEnd]
  );

  // Pivot logs into grid data
  const gridData: GridData = useMemo(() => {
    const map: GridData = new Map();
    for (const log of logs) {
      const ts = new Date(log.start_timestamp!);
      const dateKey = ts.toISOString().slice(0, 10);
      const hourKey = String(ts.getUTCHours()).padStart(2, "0");
      map.set(`${dateKey}|${hourKey}`, {
        id: log.id,
        activityName: log.activity_name ?? undefined,
      });
    }
    return map;
  }, [logs]);

  // Query weekly ratings
  const weekRangeStartDate = format(days[0], "yyyy-MM-dd");
  const weekRangeEndDate = format(days[days.length - 1], "yyyy-MM-dd");
  const { data: weekRatings } = useQuery<DailyRating & { id: string }>(
    "SELECT * FROM daily_ratings WHERE rating_date >= ? AND rating_date <= ?",
    [weekRangeStartDate, weekRangeEndDate]
  );

  const ratingsMap = useMemo(
    () => new Map(weekRatings.filter((r) => r.rating_date).map((r) => [r.rating_date as string, r.score as number])),
    [weekRatings]
  );

  // Keep widget props consistent: only update when gridData belongs to current days.
  // useQuery resolves a frame late on week change, so widgets would briefly see
  // new days + stale data, causing an empty-state flash.
  const widgetProps = useRef({ days, data: gridData, ratings: ratingsMap });
  const isDataStale = useMemo(() => {
    if (gridData.size === 0) return false; // genuinely empty week — not stale
    const firstKey = gridData.keys().next().value as string | undefined;
    if (!firstKey) return false;
    const keyDate = firstKey.split("|")[0];
    const startDate = format(days[0], "yyyy-MM-dd");
    const endDate = format(days[days.length - 1], "yyyy-MM-dd");
    return keyDate < startDate || keyDate > endDate;
  }, [days, gridData]);

  if (!isDataStale) {
    widgetProps.current = { days, data: gridData, ratings: ratingsMap };
  }

  const ratingsIdMap = useMemo(
    () => new Map(weekRatings.filter((r) => r.rating_date).map((r) => [r.rating_date as string, r.id])),
    [weekRatings]
  );

  // Rating upsert handler
  const handleRate = useCallback(
    async (dateStr: string, score: number) => {
      const existingId = ratingsIdMap.get(dateStr);
      const existingScore = ratingsMap.get(dateStr);

      if (existingScore === score) {
        // Deselect
        if (existingId) {
          await db.execute("DELETE FROM daily_ratings WHERE id = ?", [existingId]);
        }
        return;
      }

      if (existingId) {
        await db.execute("UPDATE daily_ratings SET score = ? WHERE id = ?", [score, existingId]);
      } else {
        const userId = await getCurrentUserId();
        await db.execute(
          `INSERT INTO daily_ratings (id, user_id, rating_date, score, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
          [uuidv4(), userId, dateStr, score]
        );
      }
    },
    [db, ratingsMap, ratingsIdMap]
  );

  // Cell click handler
  const handleCellClick = useCallback(
    async (day: Date, hour: number, existing: GridCell | undefined) => {
      if (!activeActivity) return;

      const isoTimestamp = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour)).toISOString();

      if (activeActivity === "__eraser__") {
        if (existing?.id) {
          await db.execute("DELETE FROM time_logs WHERE id = ?", [existing.id]);
        }
        return;
      }

      if (existing?.id) {
        await db.execute(
          "UPDATE time_logs SET activity_name = ? WHERE id = ?",
          [activeActivity, existing.id]
        );
      } else {
        const userId = await getCurrentUserId();
        const id = uuidv4();
        await db.execute(
          `INSERT INTO time_logs (id, user_id, activity_name, start_timestamp, duration_minutes, created_at)
           VALUES (?, ?, ?, ?, 60, ?)`,
          [id, userId, activeActivity, isoTimestamp, new Date().toISOString()]
        );
      }
    },
    [activeActivity, db]
  );

  // Track first successful load to avoid skeleton flicker on week switch
  if (!loadingActivities && !loadingLogs) {
    hasLoadedOnce.current = true;
  }
  const showSkeleton = !hasLoadedOnce.current && (loadingActivities || loadingLogs);

  // When clicking a day in the year rating grid, jump to that week
  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setView("week");
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="flex flex-col h-full">
      <AppHeader
        app={trackerApp}
        mobileMenuItems={
          <ManageActivitiesDialog>
            <div className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
              <Timer className="h-4 w-4" />
              Manage Activities
            </div>
          </ManageActivitiesDialog>
        }
        actions={<ManageActivitiesDialog />}
      />

      {/* View Tabs */}
      <div className="border-b border-border px-4 flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setView("week")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            view === "week" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Week
        </button>
        <button
          onClick={() => setView("activity")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            view === "activity" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          Activity
        </button>
        <button
          onClick={() => setView("mood")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
            view === "mood" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Smile className="h-3.5 w-3.5" />
          Mood
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Week View */}
        {view === "week" && (
          <>
            <WeekNavigator currentDate={currentDate} onDateChange={setCurrentDate} />

            {showSkeleton ? (
              <WeekViewSkeleton />
            ) : (
              <div className={cn("transition-opacity duration-150", isDataStale && "opacity-70")}>
                <section>
                  <ActivityToolbar
                    activities={activityTypes.map((a) => ({ name: a.name ?? "", color: a.color ?? "teal" }))}
                    active={activeActivity}
                    onSelect={setActiveActivity}
                  />
                </section>

                <section>
                  <TimeGrid days={days} data={gridData} colorMap={activityColorMap} onCellClick={handleCellClick} ratings={ratingsMap} onRate={handleRate} />
                </section>

                <section className="mt-4 pb-16 sm:pb-0">
                  <WeekWidgets days={widgetProps.current.days} data={widgetProps.current.data} colorMap={activityColorMap} ratings={widgetProps.current.ratings} />
                </section>
              </div>
            )}
          </>
        )}

        {/* Year Activity Heatmap */}
        {view === "activity" && (
          <YearActivityGrid
            year={selectedYear}
            onDayClick={handleDayClick}
            headerLeft={
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedYear} onValueChange={(v: any) => setSelectedYear(parseInt(String(v), 10))}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          />
        )}

        {/* Year Rating Heatmap */}
        {view === "mood" && (
          <YearRatingGrid
            year={selectedYear}
            onDayClick={handleDayClick}
            headerLeft={
              <div className="flex items-center gap-2 shrink-0">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedYear} onValueChange={(v: any) => setSelectedYear(parseInt(String(v), 10))}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
