import { db } from '@/lib/powersync/db';

const DEBOUNCE_MS = 1000;

// ─── Debounced Field Updates (merges per task ID) ───────────────────────────

interface PendingUpdate {
  fields: Record<string, string | null>;
  timer: ReturnType<typeof setTimeout>;
}

const pendingUpdates = new Map<string, PendingUpdate>();

/**
 * Queue a debounced UPDATE for a task field.
 * Multiple calls for the same taskId within 2s merge fields and reset the timer.
 */
export function debouncedUpdate(taskId: string, field: string, value: string | null) {
  const existing = pendingUpdates.get(taskId);

  if (existing) {
    existing.fields[field] = value;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => flushUpdate(taskId), DEBOUNCE_MS);
  } else {
    const fields: Record<string, string | null> = { [field]: value };
    const timer = setTimeout(() => flushUpdate(taskId), DEBOUNCE_MS);
    pendingUpdates.set(taskId, { fields, timer });
  }
}

/**
 * Immediately flush any pending debounced update for a task.
 */
export function flushUpdate(taskId: string) {
  const pending = pendingUpdates.get(taskId);
  if (!pending) return;

  clearTimeout(pending.timer);
  pendingUpdates.delete(taskId);

  const fields = pending.fields;
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const setClauses = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);

  db.execute(
    `UPDATE tasks SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, taskId]
  );
}

// ─── Debounced SQL Executes (for INSERTs and other one-shot writes) ─────────

interface PendingExecute {
  sql: string;
  params: any[];
}

const pendingExecutes: PendingExecute[] = [];
let executeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Queue a debounced SQL execute (e.g. INSERT).
 * All queued statements flush together after 2s of inactivity.
 * Each new call resets the 2s timer.
 */
export function debouncedExecute(sql: string, params: any[]) {
  pendingExecutes.push({ sql, params });
  if (executeTimer) clearTimeout(executeTimer);
  executeTimer = setTimeout(flushExecutes, DEBOUNCE_MS);
}

/**
 * Immediately flush all pending SQL executes.
 */
export function flushExecutes() {
  if (executeTimer) { clearTimeout(executeTimer); executeTimer = null; }
  const batch = pendingExecutes.splice(0);
  for (const { sql, params } of batch) {
    db.execute(sql, params);
  }
}

// ─── Global flush & pending state ──────────────────────────────────────────

/**
 * Returns true if there are any pending debounced writes.
 */
export function hasPendingWrites(): boolean {
  return pendingUpdates.size > 0 || pendingExecutes.length > 0;
}

/**
 * Flush everything — all pending updates and executes.
 */
export function flushAllUpdates() {
  for (const taskId of pendingUpdates.keys()) {
    flushUpdate(taskId);
  }
  flushExecutes();
}
