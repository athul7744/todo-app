import { db } from '@/lib/powersync/db';
import { serializeNoteDocument } from '@/lib/notes/notes-content';

const DEBOUNCE_MS = 1000;
type SQLValue = string | number | null;
const TABLES_WITH_UPDATED_AT = new Set(['tasks', 'pages', 'blocks']);
export const SQL_UTC_NOW_EXPRESSION = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

type AfterFlushCallback = () => Promise<void> | void;

interface DebouncedUpdateOptions {
  debounceMs?: number;
  afterFlush?: AfterFlushCallback;
}

function getPendingUpdateKey(table: string, id: string) {
  return `${table}:${id}`;
}

interface PendingUpdate {
  id: string;
  table: string;
  fields: Record<string, SQLValue>;
  debounceMs: number;
  afterFlush?: AfterFlushCallback;
  timer: ReturnType<typeof setTimeout>;
}

const pendingUpdates = new Map<string, PendingUpdate>();

function areSQLValuesEqual(table: string, field: string, currentValue: SQLValue, nextValue: SQLValue) {
  if (currentValue === nextValue) {
    return true;
  }

  if (table === 'blocks' && field === 'content' && typeof currentValue === 'string' && typeof nextValue === 'string') {
    return serializeNoteDocument(currentValue) === serializeNoteDocument(nextValue);
  }

  return false;
}

function getPendingUpdateEntries(id: string, table?: string) {
  const entries: Array<[string, PendingUpdate]> = [];

  pendingUpdates.forEach((pending, key) => {
    if (pending.id !== id) return;
    if (table && pending.table !== table) return;
    entries.push([key, pending]);
  });

  return entries;
}

function normalizeDebouncedUpdateOptions(optionsOrDebounceMs?: DebouncedUpdateOptions | number) {
  if (typeof optionsOrDebounceMs === 'number') {
    return {
      debounceMs: optionsOrDebounceMs,
    };
  }

  return {
    afterFlush: optionsOrDebounceMs?.afterFlush,
    debounceMs: optionsOrDebounceMs?.debounceMs ?? DEBOUNCE_MS,
  };
}

export function debouncedUpdate(
  id: string,
  field: string,
  value: SQLValue,
  table = 'tasks',
  optionsOrDebounceMs: DebouncedUpdateOptions | number = DEBOUNCE_MS
) {
  const { afterFlush, debounceMs } = normalizeDebouncedUpdateOptions(optionsOrDebounceMs);
  const pendingKey = getPendingUpdateKey(table, id);
  const existing = pendingUpdates.get(pendingKey);

  if (existing) {
    existing.fields[field] = value;
    existing.debounceMs = debounceMs;
    existing.afterFlush = afterFlush ?? existing.afterFlush;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => flushUpdate(id, table), debounceMs);
  } else {
    const fields: Record<string, SQLValue> = { [field]: value };
    const timer = setTimeout(() => flushUpdate(id, table), debounceMs);
    pendingUpdates.set(pendingKey, { id, table, fields, debounceMs, afterFlush, timer });
  }
}

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

export async function flushUpdate(id: string, table?: string): Promise<any> {
  const entries = getPendingUpdateEntries(id, table);
  if (entries.length === 0) return undefined;

  const executions = await Promise.all(entries.map(async ([pendingKey, pending]) => {
    clearTimeout(pending.timer);
    pendingUpdates.delete(pendingKey);

    const keys = Object.keys(pending.fields);
    if (keys.length === 0) return undefined;

    const currentRow = await db.getOptional<Record<string, SQLValue>>(
      `SELECT ${keys.join(', ')} FROM ${pending.table} WHERE id = ? LIMIT 1`,
      [pending.id]
    );

    const changedKeys = currentRow
      ? keys.filter((field) => !areSQLValuesEqual(pending.table, field, currentRow[field], pending.fields[field]))
      : keys;

    if (changedKeys.length === 0) {
      return undefined;
    }

    const setClauses = changedKeys.map((field) => `${field} = ?`);
    const values = changedKeys.map((field) => pending.fields[field]);

    if (TABLES_WITH_UPDATED_AT.has(pending.table)) {
      setClauses.push(`updated_at = ${SQL_UTC_NOW_EXPRESSION}`);
    }

    await db.execute(
      `UPDATE ${pending.table} SET ${setClauses.join(', ')} WHERE id = ?`,
      [...values, pending.id]
    );

    await pending.afterFlush?.();
    return true;
  }));

  const completedExecutions = executions.filter(Boolean);
  if (completedExecutions.length === 0) return undefined;
  if (completedExecutions.length === 1) return completedExecutions[0];

  return completedExecutions;
}

interface PendingExecute {
  id?: string;
  sql: string;
  params: any[];
}

const pendingExecutes: PendingExecute[] = [];
let executeTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedExecute(sql: string, params: any[], entityId?: string, debounceMs = DEBOUNCE_MS) {
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
  executeTimer = setTimeout(flushExecutes, debounceMs);
}

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

export async function flushExecutes() {
  if (executeTimer) { clearTimeout(executeTimer); executeTimer = null; }
  const batch = pendingExecutes.splice(0);
  for (const { sql, params } of batch) {
    await db.execute(sql, params);
  }
}

export function hasPendingWrites(): boolean {
  return pendingUpdates.size > 0 || pendingExecutes.length > 0;
}

export async function flushAllUpdates() {
  await flushExecutes();

  const updatePromises: (Promise<any> | undefined)[] = [];
  const pendingIds = new Set(Array.from(pendingUpdates.values(), (pending) => pending.id));
  for (const id of pendingIds) {
    updatePromises.push(flushUpdate(id));
  }

  await Promise.all(updatePromises.filter(Boolean));
}