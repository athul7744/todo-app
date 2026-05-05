import { db } from '@/lib/powersync/db';

const DEBOUNCE_MS = 1000;
type SQLValue = string | number | null;

// ─── Debounced Field Updates (merges per record ID) ─────────────────────────

interface PendingUpdate {
  table: string;
  fields: Record<string, SQLValue>;
  timer: ReturnType<typeof setTimeout>;
}

const pendingUpdates = new Map<string, PendingUpdate>();

/**
 * Queue a debounced UPDATE for a record field.
 * Multiple calls for the same id within DEBOUNCE_MS merge fields and reset the timer.
 */
export function debouncedUpdate(id: string, field: string, value: SQLValue, table = 'tasks') {
  const existing = pendingUpdates.get(id);

  if (existing) {
    existing.fields[field] = value;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => flushUpdate(id), DEBOUNCE_MS);
  } else {
    const fields: Record<string, SQLValue> = { [field]: value };
    const timer = setTimeout(() => flushUpdate(id), DEBOUNCE_MS);
    pendingUpdates.set(id, { table, fields, timer });
  }
}

/**
 * Cancel a pending debounced field update for a record.
 * If no fields remain for the record, its timer is cleared and the pending update is removed.
 */
export function cancelUpdate(id: string, field: string) {
  const pending = pendingUpdates.get(id);
  if (!pending || !(field in pending.fields)) return;

  delete pending.fields[field];
  if (Object.keys(pending.fields).length > 0) return;

  clearTimeout(pending.timer);
  pendingUpdates.delete(id);
}

/**
 * Immediately flush any pending debounced update for a record.
 * Returns the promise from db.execute so callers can await it.
 */
export function flushUpdate(id: string): Promise<any> | undefined {
  const pending = pendingUpdates.get(id);
  if (!pending) return undefined;

  clearTimeout(pending.timer);
  pendingUpdates.delete(id);

  const { table, fields } = pending;
  const keys = Object.keys(fields);
  if (keys.length === 0) return undefined;

  const setClauses = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);

  return db.execute(
    `UPDATE ${table} SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
}

// ─── Debounced SQL Executes (for INSERTs and other one-shot writes) ─────────

interface PendingExecute {
  id?: string; // optional entity ID for cancellation
  sql: string;
  params: any[];
}

const pendingExecutes: PendingExecute[] = [];
let executeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Queue a debounced SQL execute (e.g. INSERT).
 * All queued statements flush together after DEBOUNCE_MS of inactivity.
 * Optionally associate an entity ID so it can be replaced or cancelled before flush.
 */
export function debouncedExecute(sql: string, params: any[], entityId?: string) {
  if (entityId) {
    const existing = pendingExecutes.find((execute) => execute.id === entityId);
    if (existing) {
      existing.sql = sql;
      existing.params = params;
    } else {
      pendingExecutes.push({ id: entityId, sql, params });
    }
  } else {
    pendingExecutes.push({ id: entityId, sql, params });
  }

  if (executeTimer) clearTimeout(executeTimer);
  executeTimer = setTimeout(flushExecutes, DEBOUNCE_MS);
}

/**
 * Cancel a pending execute by entity ID (e.g. if the entity is deleted before flush).
 */
export function cancelExecute(entityId: string) {
  for (let index = pendingExecutes.length - 1; index >= 0; index--) {
    if (pendingExecutes[index].id === entityId) {
      pendingExecutes.splice(index, 1);
    }
  }

  if (pendingExecutes.length === 0 && executeTimer) {
    clearTimeout(executeTimer);
    executeTimer = null;
  }
}

/**
 * Immediately flush all pending SQL executes.
 */
export async function flushExecutes() {
  if (executeTimer) { clearTimeout(executeTimer); executeTimer = null; }
  const batch = pendingExecutes.splice(0);
  for (const { sql, params } of batch) {
    await db.execute(sql, params);
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
export async function flushAllUpdates() {
  const updatePromises: (Promise<any> | undefined)[] = [];
  for (const id of [...pendingUpdates.keys()]) {
    updatePromises.push(flushUpdate(id));
  }
  await Promise.all(updatePromises.filter(Boolean));
  await flushExecutes();
}
