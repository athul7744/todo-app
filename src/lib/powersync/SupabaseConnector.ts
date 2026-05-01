import { PowerSyncBackendConnector, AbstractPowerSyncDatabase, UpdateType } from '@powersync/web';
import { createClient } from '../supabase/client';

const UPLOAD_DEBOUNCE_MS = 2000;

export class SupabaseConnector implements PowerSyncBackendConnector {
  client = createClient();

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingUpload: Promise<void> | null = null;
  private _pendingResolve: (() => void) | null = null;

  async fetchCredentials() {
    const { data: { session }, error } = await this.client.auth.getSession();
    
    if (error) {
      console.error("PowerSync fetchCredentials error:", error);
      return null;
    }

    if (!session) {
      console.warn("PowerSync fetchCredentials: No session available");
      return null;
    }

    const endpoint = process.env.NEXT_PUBLIC_POWERSYNC_URL;
    if (!endpoint) {
      throw new Error("NEXT_PUBLIC_POWERSYNC_URL is not set");
    }

    return {
      endpoint,
      token: session.access_token,
      expiresAt: new Date(session.expires_at ? session.expires_at * 1000 : Date.now() + 60 * 60 * 1000)
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    // Debounce: wait 2s after the last call before actually uploading.
    // If uploadData is called again within 2s (new edit), restart the timer.

    // Clear any existing timer — this resets the debounce window
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }

    // If there's already a pending debounce promise, piggyback on it
    if (this._pendingUpload) {
      // Restart the timer but return the same promise
      this._pendingUpload = new Promise<void>((resolve) => {
        this._pendingResolve = resolve;
        this._debounceTimer = setTimeout(() => {
          this._debounceTimer = null;
          this._pendingUpload = null;
          this._drainQueue(database).then(resolve);
        }, UPLOAD_DEBOUNCE_MS);
      });
      return this._pendingUpload;
    }

    // First call — create the debounce promise
    this._pendingUpload = new Promise<void>((resolve) => {
      this._pendingResolve = resolve;
      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null;
        this._pendingUpload = null;
        this._drainQueue(database).then(resolve);
      }, UPLOAD_DEBOUNCE_MS);
    });

    return this._pendingUpload;
  }

  private async _drainQueue(database: AbstractPowerSyncDatabase): Promise<void> {
    let transaction;
    while ((transaction = await database.getNextCrudTransaction())) {
      try {
        for (const op of transaction.crud) {
          const table = op.table;
          const opData = op.opData || {};

          switch (op.op) {
            case UpdateType.PUT: {
              const { error } = await this.client.from(table).upsert({ ...opData, id: op.id });
              if (error) throw new Error(error.message);
              break;
            }
            case UpdateType.PATCH: {
              const { error } = await this.client.from(table).update(opData).eq('id', op.id);
              if (error) throw new Error(error.message);
              break;
            }
            case UpdateType.DELETE: {
              const { error } = await this.client.from(table).delete().eq('id', op.id);
              if (error) throw new Error(error.message);
              break;
            }
          }
        }
        await transaction.complete();
      } catch (ex) {
        console.error("PowerSync Upload Error:", ex);
        break;
      }
    }
  }
}
