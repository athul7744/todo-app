import { v4 as uuidv4 } from "uuid";
import { TAG_COLORS } from "@/lib/colors";
import { getCurrentUserId } from "@/lib/auth";
import { debouncedExecute } from "@/lib/debounced-update";

/**
 * Insert a new tag into the local PowerSync database.
 * Returns the generated tag id so callers can optimistically reference it.
 */
export async function createTag(
  name: string,
  color?: string,
  dedupeKey?: string,
  id?: string
): Promise<string> {
  const resolvedId = id ?? uuidv4();
  const resolvedColor = color ?? TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  const userId = await getCurrentUserId();

  debouncedExecute(
    `INSERT INTO tags (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
    [resolvedId, userId, name, resolvedColor],
    dedupeKey ?? resolvedId
  );

  return resolvedId;
}
