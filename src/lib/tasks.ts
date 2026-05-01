import { createClient } from "@/lib/supabase/client";

let cachedUserId: string | null = null;

/**
 * Get the currently authenticated user's ID.
 * Caches the result after the first call since user ID doesn't change during a session.
 */
export async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  cachedUserId = user?.id || "";
  return cachedUserId;
}

/**
 * Priority color definitions for task indicators.
 */
export const PRIORITY_COLORS: Record<string, { bg: string; ring: string }> = {
  low: { bg: "bg-sky-500", ring: "ring-sky-500/30" },
  medium: { bg: "bg-amber-500", ring: "ring-amber-500/30" },
  high: { bg: "bg-orange-500", ring: "ring-orange-500/30" },
  urgent: { bg: "bg-red-600", ring: "ring-red-600/30" },
};

export const PRIORITY_LEVELS = Object.keys(PRIORITY_COLORS) as Array<keyof typeof PRIORITY_COLORS>;

/**
 * Compute due date display info from a Date object.
 */
export function getDueDateInfo(dueDate: Date | undefined): {
  show: boolean;
  bg: string;
  text: string;
  label: string;
} {
  if (!dueDate) {
    return { show: false, bg: "", text: "", label: "" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      show: true,
      bg: "bg-red-500/20 dark:bg-red-900/40",
      text: "text-red-700 dark:text-red-400 font-bold",
      label: "Overdue",
    };
  }
  if (diffDays === 0) {
    return {
      show: true,
      bg: "bg-red-500/10 dark:bg-red-500/20",
      text: "text-red-600 dark:text-red-400 font-bold",
      label: "Due Today",
    };
  }
  if (diffDays <= 2) {
    return {
      show: true,
      bg: "bg-orange-500/10 dark:bg-orange-500/20",
      text: "text-orange-600 dark:text-orange-400 font-semibold",
      label: `Due in ${diffDays} Days`,
    };
  }
  return {
    show: true,
    bg: "bg-green-500/10 dark:bg-green-500/20",
    text: "text-green-600 dark:text-green-400 font-medium",
    label: `Due in ${diffDays} Days`,
  };
}

/**
 * Auto-resize a textarea to fit its content.
 */
export function autoResizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
}
