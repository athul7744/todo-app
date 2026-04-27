import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './AppSchema';
import { SupabaseConnector } from './SupabaseConnector';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'todo-app.sqlite'
  }
});

let isInitialized = false;

export const initPowerSync = async () => {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;
  
  await db.init();
  const connector = new SupabaseConnector();
  await db.connect(connector);
};
