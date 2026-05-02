"use client";

import { usePowerSync, useQuery } from "@powersync/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { Timer } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { ActivityToolbar } from "@/components/tracker/ActivityToolbar";
import { TimeGrid, GridData, GridCell } from "@/components/tracker/TimeGrid";
import { ManageActivitiesDialog } from "@/components/tracker/ManageActivitiesDialog";
import { TimeLog, ActivityType } from "@/lib/powersync/AppSchema";
import { getCurrentUserId } from "@/lib/auth";
import { getApp } from "@/lib/apps";
import { DEFAULT_ACTIVITIES } from "@/lib/activities";

const trackerApp = getApp("tracker");
const NUM_DAYS = 7;

export default function TrackerPage() {
  const db = usePowerSync();
  const [activeActivity, setActiveActivity] = useState<string | null>(null);
  const seededRef = useRef(false);

  // Query activity types from local DB
  const { data: activityTypes } = useQuery<ActivityType & { id: string }>(
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

  // Build the 7-day window (today down to 6 days ago)
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: NUM_DAYS }, (_, i) => subDays(today, i));
  }, []);

  const rangeStart = format(days[days.length - 1], "yyyy-MM-dd'T'00:00:00'+00:00'");
  const rangeEnd = format(days[0], "yyyy-MM-dd'T'23:59:59'+00:00'");

  // Subscribe to time_logs within the 7-day window — reactive to local changes
  const { data: logs } = useQuery<TimeLog & { id: string }>(
    `SELECT id, activity_name, start_timestamp, duration_minutes
     FROM time_logs
     WHERE start_timestamp >= ? AND start_timestamp <= ?
     ORDER BY start_timestamp ASC`,
    [rangeStart, rangeEnd]
  );

  // Pivot: normalize the flat log rows into a Map keyed by "YYYY-MM-DD|HH"
  const gridData: GridData = useMemo(() => {
    const map: GridData = new Map();
    for (const log of logs) {
      const ts = new Date(log.start_timestamp!);
      const dateKey = format(ts, "yyyy-MM-dd");
      const hourKey = String(ts.getUTCHours()).padStart(2, "0");
      map.set(`${dateKey}|${hourKey}`, {
        id: log.id,
        activityName: log.activity_name ?? undefined,
      });
    }
    return map;
  }, [logs]);

  // Cell click handler — INSERT / UPDATE / DELETE based on current tool
  const handleCellClick = useCallback(
    async (day: Date, hour: number, existing: GridCell | undefined) => {
      if (!activeActivity) return; // no tool selected

      const startTimestamp = new Date(day);
      startTimestamp.setUTCHours(hour, 0, 0, 0);
      const isoTimestamp = startTimestamp.toISOString();

      if (activeActivity === "__eraser__") {
        // DELETE if a log exists
        if (existing?.id) {
          await db.execute("DELETE FROM time_logs WHERE id = ?", [existing.id]);
        }
        return;
      }

      if (existing?.id) {
        // UPDATE the existing row with new activity
        await db.execute(
          "UPDATE time_logs SET activity_name = ? WHERE id = ?",
          [activeActivity, existing.id]
        );
      } else {
        // INSERT a new log
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Toolbar */}
        <section>
          <p className="text-sm text-muted-foreground mb-2">
            Select an activity, then click cells to paint your time.
          </p>
          <ActivityToolbar
            activities={activityTypes.map((a) => ({ name: a.name ?? "", color: a.color ?? "teal" }))}
            active={activeActivity}
            onSelect={setActiveActivity}
          />
        </section>

        {/* Grid */}
        <section>
          <TimeGrid days={days} data={gridData} colorMap={activityColorMap} onCellClick={handleCellClick} />
        </section>
      </div>
    </div>
  );
}
