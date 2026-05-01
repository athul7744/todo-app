import { PowerSyncBackendConnector, AbstractPowerSyncDatabase, UpdateType, CrudEntry } from '@powersync/web';
import { createClient } from '../supabase/client';

/** Response codes that indicate a permanent/fatal error — discard the transaction. */
const FATAL_RESPONSE_CODES = [/^22/, /^23/, /^42/];

const log = {
  info: (...args: any[]) => console.log(`[PowerSync]`, ...args),
  warn: (...args: any[]) => console.warn(`[PowerSync]`, ...args),
  error: (...args: any[]) => console.error(`[PowerSync]`, ...args),
};

export class SupabaseConnector implements PowerSyncBackendConnector {
  client = createClient();

  async fetchCredentials() {
    log.info("Fetching credentials...");
    const { data: { session }, error } = await this.client.auth.getSession();
    
    if (error) {
      log.error("fetchCredentials error:", error.message);
      return null;
    }

    if (!session) {
      log.warn("fetchCredentials: No session available");
      return null;
    }

    const endpoint = process.env.NEXT_PUBLIC_POWERSYNC_URL;
    if (!endpoint) {
      throw new Error("NEXT_PUBLIC_POWERSYNC_URL is not set");
    }

    log.info("Credentials obtained, token expires at:", new Date(session.expires_at! * 1000).toLocaleTimeString());
    return {
      endpoint,
      token: session.access_token,
      expiresAt: new Date(session.expires_at ? session.expires_at * 1000 : Date.now() + 60 * 60 * 1000)
    };
  }

  /**
   * Pre-sorted Batch Strategy:
   * Groups all operations by type and table, then executes bulk calls.
   * PUT → batch upsert per table
   * DELETE → batch delete per table
   * PATCH → individual updates (can't be batched easily)
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    // getCrudBatch returns ALL pending CRUD ops as a single batch
    const batch = await database.getCrudBatch();
    if (!batch) return;

    const putOps: { [table: string]: any[] } = {};
    const deleteOps: { [table: string]: string[] } = {};
    const patchOps: CrudEntry[] = [];

    for (const op of batch.crud) {
      switch (op.op) {
        case UpdateType.PUT:
          if (!putOps[op.table]) putOps[op.table] = [];
          putOps[op.table].push({ ...op.opData, id: op.id });
          break;
        case UpdateType.PATCH:
          patchOps.push(op);
          break;
        case UpdateType.DELETE:
          if (!deleteOps[op.table]) deleteOps[op.table] = [];
          deleteOps[op.table].push(op.id);
          break;
      }
    }

    try {
      // Execute bulk PUTs (upsert) per table
      for (const table of Object.keys(putOps)) {
        const records = putOps[table];
        log.info(`BATCH PUT ${table}: ${records.length} record(s)`);
        const { error } = await this.client.from(table).upsert(records);
        if (error) throw new Error(`PUT ${table} failed: ${error.message}`);
      }

      // Execute bulk DELETEs per table
      for (const table of Object.keys(deleteOps)) {
        const ids = deleteOps[table];
        log.info(`BATCH DELETE ${table}: ${ids.length} record(s)`);
        const { error } = await this.client.from(table).delete().in('id', ids);
        if (error) throw new Error(`DELETE ${table} failed: ${error.message}`);
      }

      // Execute PATCH operations individually (partial updates can't be easily batched)
      for (const op of patchOps) {
        log.info(`PATCH ${op.table}/${op.id}`, Object.keys(op.opData || {}).join(", "));
        const { error } = await this.client.from(op.table).update(op.opData || {}).eq('id', op.id);
        if (error) throw new Error(`PATCH ${op.table}/${op.id} failed: ${error.message}`);
      }

      await batch.complete();

      const total = Object.values(putOps).reduce((s, r) => s + r.length, 0)
        + Object.values(deleteOps).reduce((s, r) => s + r.length, 0)
        + patchOps.length;
      log.info(`Upload complete — ${total} op(s) batched`);

    } catch (ex: any) {
      if (typeof ex?.code === 'string' && FATAL_RESPONSE_CODES.some(regex => regex.test(ex.code))) {
        // Fatal error — discard batch to unblock the queue
        log.error("Fatal upload error — discarding batch:", ex.message || ex);
        await batch.complete();
      } else {
        // Retryable error — throw to trigger retry after delay
        log.error("Upload error (will retry):", ex.message || ex);
        throw ex;
      }
    }
  }
}
