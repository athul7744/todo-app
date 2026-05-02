"use client";

import * as React from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { v4 as uuidv4 } from "uuid";
import { Plus, Trash2, Timer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getCurrentUserId } from "@/lib/auth";
import { debouncedExecute } from "@/lib/debounced-update";
import {
  ACTIVITY_COLORS,
  ACTIVITY_CELL_CLASSES,
  getActivityDotClass,
} from "@/lib/activities";
import { ActivityType } from "@/lib/powersync/AppSchema";

export function ManageActivitiesDialog({ children }: { children?: React.ReactNode }) {
  const db = usePowerSync();
  const { data: activities } = useQuery<ActivityType & { id: string }>(
    "SELECT * FROM activity_types ORDER BY created_at ASC"
  );

  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState<string>(ACTIVITY_COLORS[0]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const id = uuidv4();
    const name = newName.trim();
    const color = newColor;

    setNewName("");
    setNewColor(ACTIVITY_COLORS[Math.floor(Math.random() * ACTIVITY_COLORS.length)]);

    const userId = await getCurrentUserId();
    debouncedExecute(
      `INSERT INTO activity_types (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [id, userId, name, color],
      id
    );
  };

  const handleDelete = async (id: string) => {
    await db.execute(`DELETE FROM activity_types WHERE id = ?`, [id]);
  };

  const handleUpdateColor = (id: string, color: string) => {
    debouncedExecute(
      `UPDATE activity_types SET color = ? WHERE id = ?`,
      [color, id]
    );
  };

  return (
    <Dialog>
      {children ? (
        <DialogTrigger className="w-full">
          {children}
        </DialogTrigger>
      ) : (
        <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap text-xs font-medium hover:bg-accent hover:text-teal-600 dark:hover:text-teal-400 h-8 rounded-full px-2.5 gap-1.5 transition-colors">
          <Timer className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Activities</span>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Activities</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          {/* Add new activity */}
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="activityName">Create New Activity</Label>
              <div className="flex gap-2">
                <Input
                  id="activityName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Activity name..."
                  maxLength={30}
                  className="flex-1"
                />
                <Button type="submit" disabled={!newName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {/* Color picker */}
            <div className="flex flex-wrap gap-2 mt-1">
              {ACTIVITY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewColor(color)}
                  className={cn(
                    "h-6 w-6 rounded-full cursor-pointer transition-transform hover:scale-110",
                    getActivityDotClass(color),
                    newColor === color
                      ? "ring-2 ring-offset-2 ring-primary ring-offset-background scale-110"
                      : ""
                  )}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </form>

          {/* Existing activities list */}
          <div className="border-t pt-4">
            <Label className="mb-3 block text-muted-foreground">Existing Activities</Label>
            <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  No activities created yet.
                </p>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between group rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {/* Color dot with inline color picker */}
                      <Popover>
                        <PopoverTrigger
                          className={cn(
                            "h-4 w-4 rounded-full cursor-pointer hover:scale-110 transition-transform ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            getActivityDotClass(activity.color || "teal")
                          )}
                          title="Change color"
                        />
                        <PopoverContent className="w-[200px] p-2" align="start">
                          <div className="flex flex-wrap gap-2">
                            {ACTIVITY_COLORS.map((color) => (
                              <button
                                key={color}
                                onClick={() => handleUpdateColor(activity.id, color)}
                                className={cn(
                                  "h-5 w-5 rounded-full cursor-pointer transition-transform hover:scale-110",
                                  getActivityDotClass(color),
                                  activity.color === color
                                    ? "ring-2 ring-offset-1 ring-primary ring-offset-background scale-110"
                                    : ""
                                )}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-sm",
                          ACTIVITY_CELL_CLASSES[activity.color || "teal"] ?? ACTIVITY_CELL_CLASSES["teal"]
                        )}
                      >
                        {activity.name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(activity.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
