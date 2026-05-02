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
