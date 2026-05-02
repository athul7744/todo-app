import { ListTodo, Clock, type LucideIcon } from "lucide-react";

export interface AppAccent {
  /** Icon background: e.g. "bg-indigo-500/10 dark:bg-indigo-500/20" */
  iconBg: string;
  /** Icon/dot foreground: e.g. "text-indigo-600 dark:text-indigo-400" */
  iconText: string;
}

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: AppAccent;
}

export const APPS: AppConfig[] = [
  {
    id: "tasks",
    name: "Tasks",
    description: "Manage todos with subtasks, tags, and priorities",
    href: "/tasks",
    icon: ListTodo,
    accent: {
      iconBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      iconText: "text-indigo-600 dark:text-indigo-400",
    },
  },
  {
    id: "tracker",
    name: "Tracker",
    description: "Log time blocks on a 24-hour paint grid",
    href: "/tracker",
    icon: Clock,
    accent: {
      iconBg: "bg-teal-500/10 dark:bg-teal-500/20",
      iconText: "text-teal-600 dark:text-teal-400",
    },
  },
];

export function getApp(id: string): AppConfig {
  return APPS.find((a) => a.id === id) ?? APPS[0];
}
