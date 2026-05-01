import { PowerSyncBackendConnector, AbstractPowerSyncDatabase, UpdateType } from '@powersync/web';
import { createClient } from '../supabase/client';

export class SupabaseConnector implements PowerSyncBackendConnector {
  client = createClient();

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
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

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
    }
  }
}
