"use client";

import { ChevronLeft, ChevronRight, Hash, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const handleWeekChange = (value: any) => {
    const newWeek = parseInt(String(value), 10);
    const newDate = setWeek(currentDate, newWeek, { weekStartsOn: 1 });
    onDateChange(newDate);
  };

  const handleYearChange = (value: any) => {
    const newYear = parseInt(String(value), 10);
    const newDate = setYear(currentDate, newYear);
    onDateChange(newDate);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

  return (
    <>
      {/* Desktop: inline */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1.5 text-sm">
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={weekNum} onValueChange={handleWeekChange}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((w) => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={year} onValueChange={handleYearChange}>
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

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <span className="text-xs text-muted-foreground ml-2">
          {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
        </span>
      </div>

      {/* Mobile: FAB at bottom */}
      <div className="sm:hidden fixed inset-x-0 -bottom-4 z-40 h-32 pointer-events-none" style={{ background: "linear-gradient(to top, var(--background) 0%, var(--background) 30%, color-mix(in oklch, var(--background) 80%, transparent) 60%, transparent 100%)" }} />
      <div className="sm:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-card border border-border rounded-full px-3 py-2 shadow-[0_0_40px_8px_rgba(0,0,0,0.5)]">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrev}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        <div className="flex items-center gap-1 text-xs">
          <Select value={weekNum} onValueChange={handleWeekChange}>
            <SelectTrigger size="sm" className="h-6 text-xs px-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weeks.map((w) => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-[10px]">/</span>
          <Select value={year} onValueChange={handleYearChange}>
            <SelectTrigger size="sm" className="h-6 text-xs px-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNext}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </>
  );
}
