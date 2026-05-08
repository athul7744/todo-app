"use client";

import { AppHeader } from "../../components/AppHeader";
import { TasksContentSkeleton, TasksFilterRowSkeleton } from "../../components/tasks/TasksPageSkeleton";
import { getApp } from "../../lib/shared/apps";

const tasksApp = getApp("tasks");

export default function Loading() {
  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      <AppHeader app={tasksApp}>
        <TasksFilterRowSkeleton />
      </AppHeader>
      <TasksContentSkeleton />
    </div>
  );
}