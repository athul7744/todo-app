"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, getWeek, getYear, setWeek, setYear } from "date-fns";

interface WeekNavigatorProps {
  /** The reference date representing the current week */
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export function WeekNavigator({ currentDate, onDateChange }: WeekNavigatorProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekNum = getWeek(currentDate, { weekStartsOn: 1 });
  const year = getYear(currentDate);

  const goToPrev = () => onDateChange(subWeeks(currentDate, 1));
  const goToNext = () => onDateChange(addWeeks(currentDate, 1));

  const handleWeekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newWeek = parseInt(e.target.value, 10);
    const newDate = setWeek(currentDate, newWeek, { weekStartsOn: 1 });
    onDateChange(newDate);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    const newDate = setYear(currentDate, newYear);
    onDateChange(newDate);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Week</span>
        <select
          value={weekNum}
          onChange={handleWeekChange}
          className="bg-transparent border border-border rounded px-1.5 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <span className="text-muted-foreground">of</span>
        <select
          value={year}
          onChange={handleYearChange}
          className="bg-transparent border border-border rounded px-1.5 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
        {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
      </span>
    </div>
  );
}
