import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './AppSchema';
import { SupabaseConnector } from './SupabaseConnector';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'todo-app.sqlite'
  }
});

let isLocalReady = false;
let isCloudConnected = false;

/** Phase 1: Open local SQLite — fast, no network. UI can render after this. */
export const initLocal = async () => {
  if (isLocalReady || typeof window === 'undefined') return;
  isLocalReady = true;
  await db.init();
};

/** Phase 2: Connect to PowerSync cloud — runs in background, doesn't block UI. */
export const connectCloud = async () => {
  if (isCloudConnected || typeof window === 'undefined') return;
  isCloudConnected = true;
  const connector = new SupabaseConnector();
  await db.connect(connector, {
    crudUploadThrottleMs: 2000,
    retryDelayMs: 5000
  });
};

/** Delete local SQLite database and re-sync all data from the cloud. */
export const resetLocalDatabase = async () => {
  if (typeof window === 'undefined') return;
  // Disconnect from cloud sync
  await db.disconnect();
  // Delete all local data
  await db.disconnectAndClear();
  // Reset flags so we can re-initialize
  isLocalReady = false;
  isCloudConnected = false;
  // Re-initialize
  await initLocal();
  await connectCloud();
};
