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
  const controls = useWeekNavigatorControls(currentDate, onDateChange);

  return (
    <div className="hidden sm:flex items-center gap-2 flex-wrap">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={controls.goToPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1.5 text-sm">
        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={controls.weekNum} onValueChange={controls.handleWeekChange}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {controls.weeks.map((week) => (
              <SelectItem key={week} value={week}>{week}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={controls.year} onValueChange={controls.handleYearChange}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {controls.years.map((itemYear) => (
              <SelectItem key={itemYear} value={itemYear}>{itemYear}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={controls.goToNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      <span className="text-xs text-muted-foreground ml-2">
        {format(controls.weekStart, "MMM d")} – {format(controls.weekEnd, "MMM d, yyyy")}
      </span>
    </div>
  );
}

export function WeekNavigatorFab({ currentDate, onDateChange }: WeekNavigatorProps) {
  const controls = useWeekNavigatorControls(currentDate, onDateChange);

  return (
    <>
      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={controls.goToPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1 text-xs">
        <Select value={controls.weekNum} onValueChange={controls.handleWeekChange}>
          <SelectTrigger size="sm" className="h-7 text-xs px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {controls.weeks.map((week) => (
              <SelectItem key={week} value={week}>{week}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-[10px]">/</span>
        <Select value={controls.year} onValueChange={controls.handleYearChange}>
          <SelectTrigger size="sm" className="h-7 text-xs px-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {controls.years.map((itemYear) => (
              <SelectItem key={itemYear} value={itemYear}>{itemYear}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={controls.goToNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </>
  );
}

function useWeekNavigatorControls(currentDate: Date, onDateChange: (date: Date) => void) {
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

  return { goToNext, goToPrev, handleWeekChange, handleYearChange, weekEnd, weekNum, weekStart, weeks, year, years };
}
