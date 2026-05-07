import { db } from '@/lib/powersync/db';

const DEBOUNCE_MS = 1000;
type SQLValue = string | number | null;
const TABLES_WITH_UPDATED_AT = new Set(['tasks']);

function getPendingUpdateKey(table: string, id: string) {
  return `${table}:${id}`;
}

// ─── Debounced Field Updates (merges per record ID) ─────────────────────────

interface PendingUpdate {
  id: string;
  table: string;
  fields: Record<string, SQLValue>;
  timer: ReturnType<typeof setTimeout>;
}

const pendingUpdates = new Map<string, PendingUpdate>();

function getPendingUpdateEntries(id: string, table?: string) {
  const entries: Array<[string, PendingUpdate]> = [];

  pendingUpdates.forEach((pending, key) => {
    if (pending.id !== id) return;
    if (table && pending.table !== table) return;
    entries.push([key, pending]);
  });

  return entries;
}

/**
 * Queue a debounced UPDATE for a record field.
 * Multiple calls for the same id within DEBOUNCE_MS merge fields and reset the timer.
 */
export function debouncedUpdate(id: string, field: string, value: SQLValue, table = 'tasks') {
  const pendingKey = getPendingUpdateKey(table, id);
  const existing = pendingUpdates.get(pendingKey);

  if (existing) {
    existing.fields[field] = value;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => flushUpdate(id, table), DEBOUNCE_MS);
  } else {
    const fields: Record<string, SQLValue> = { [field]: value };
    const timer = setTimeout(() => flushUpdate(id, table), DEBOUNCE_MS);
    pendingUpdates.set(pendingKey, { id, table, fields, timer });
  }
}

/**
 * Cancel a pending debounced field update for a record.
 * If no fields remain for the record, its timer is cleared and the pending update is removed.
 */
export function cancelUpdate(id: string, field: string, table?: string) {
  const entries = getPendingUpdateEntries(id, table);

  entries.forEach(([pendingKey, pending]) => {
    if (!(field in pending.fields)) return;

    delete pending.fields[field];
    if (Object.keys(pending.fields).length > 0) return;

    clearTimeout(pending.timer);
    pendingUpdates.delete(pendingKey);
  });
}

/**
 * Immediately flush any pending debounced update for a record.
 * Returns the promise from db.execute so callers can await it.
 */
export function flushUpdate(id: string, table?: string): Promise<any> | undefined {
  const entries = getPendingUpdateEntries(id, table);
  if (entries.length === 0) return undefined;

  const executions = entries.flatMap(([pendingKey, pending]) => {
    clearTimeout(pending.timer);
    pendingUpdates.delete(pendingKey);

    const keys = Object.keys(pending.fields);
    if (keys.length === 0) return [];

    const setClauses = keys.map((field) => `${field} = ?`);
    const values = keys.map((field) => pending.fields[field]);

    if (TABLES_WITH_UPDATED_AT.has(pending.table)) {
      setClauses.push("updated_at = datetime('now')");
    }

    return [db.execute(
      `UPDATE ${pending.table} SET ${setClauses.join(', ')} WHERE id = ?`,
      [...values, pending.id]
    )];
  });

  if (executions.length === 0) return undefined;
  if (executions.length === 1) return executions[0];

  return Promise.all(executions);
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
  await flushExecutes();

  const updatePromises: (Promise<any> | undefined)[] = [];
  const pendingIds = new Set(Array.from(pendingUpdates.values(), (pending) => pending.id));
  for (const id of pendingIds) {
    updatePromises.push(flushUpdate(id));
  }

  await Promise.all(updatePromises.filter(Boolean));
}
