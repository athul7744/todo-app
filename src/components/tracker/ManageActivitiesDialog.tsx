"use client";

import * as React from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { Timer } from "lucide-react";
import { ManageNamedColorItemsDialog, type ManagedColorDraft } from "@/components/ManageNamedColorItemsDialog";
import { getCurrentUserId } from "@/lib/auth";
import { cancelExecute, debouncedExecute } from "@/lib/debounced-update";
import {
  ACTIVITY_COLORS,
  ACTIVITY_CELL_CLASSES,
  getActivityDotClass,
} from "@/lib/activities";
import { ActivityType } from "@/lib/powersync/AppSchema";

interface ManageActivitiesDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function ManageActivitiesDialog({ children, open, onOpenChange, hideTrigger = false }: ManageActivitiesDialogProps) {
  const db = usePowerSync();
  const { data: activities } = useQuery<ActivityType & { id: string }>(
    "SELECT * FROM activity_types ORDER BY created_at ASC"
  );

  const handleAdd = async ({ id, name, color }: ManagedColorDraft) => {
    const userId = await getCurrentUserId();
    debouncedExecute(
      `INSERT INTO activity_types (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [id, userId, name, color],
      id
    );
  };

  const handleDelete = async (id: string) => {
    cancelExecute(id);
    cancelExecute(`activity-color:${id}`);
    await db.execute(`DELETE FROM activity_types WHERE id = ?`, [id]);
  };

  const handleUpdateColor = (id: string, color: string) => {
    debouncedExecute(
      `UPDATE activity_types SET color = ? WHERE id = ?`,
      [color, id],
      `activity-color:${id}`
    );
  };

  return (
    <ManageNamedColorItemsDialog
      title="Manage Activities"
      createLabel="Create New Activity"
      emptyLabel="No activities created yet."
      existingLabel="Existing Activities"
      placeholder="Activity name..."
      itemTypeLabel="activity"
      colors={ACTIVITY_COLORS}
      defaultColor={ACTIVITY_COLORS[0]}
      items={activities}
      trigger={{
        icon: Timer,
        label: "Activities",
        hoverClassName: "hover:text-teal-600 dark:hover:text-teal-400",
      }}
      children={children}
      open={open}
      onOpenChange={onOpenChange}
      hideTrigger={hideTrigger}
      getDotClass={getActivityDotClass}
      getItemClass={(color) => ACTIVITY_CELL_CLASSES[color] ?? ACTIVITY_CELL_CLASSES.teal}
      onCreate={handleAdd}
      onDelete={handleDelete}
      onUpdateColor={handleUpdateColor}
    />
  );
}
