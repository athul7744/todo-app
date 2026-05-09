import { db } from '@/lib/powersync/db';

const DEBOUNCE_MS = 1000;
type SQLValue = string | number | null;
const TABLES_WITH_UPDATED_AT = new Set(['tasks', 'pages', 'blocks']);

function getPendingUpdateKey(table: string, id: string) {
  return `${table}:${id}`;
}

interface PendingUpdate {
  id: string;
  table: string;
  fields: Record<string, SQLValue>;
  debounceMs: number;
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

export function debouncedUpdate(id: string, field: string, value: SQLValue, table = 'tasks', debounceMs = DEBOUNCE_MS) {
  const pendingKey = getPendingUpdateKey(table, id);
  const existing = pendingUpdates.get(pendingKey);

  if (existing) {
    existing.fields[field] = value;
    existing.debounceMs = debounceMs;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => flushUpdate(id, table), debounceMs);
  } else {
    const fields: Record<string, SQLValue> = { [field]: value };
    const timer = setTimeout(() => flushUpdate(id, table), debounceMs);
    pendingUpdates.set(pendingKey, { id, table, fields, debounceMs, timer });
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