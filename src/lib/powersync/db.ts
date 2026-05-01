import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './AppSchema';
import { SupabaseConnector } from './SupabaseConnector';

const log = {
  info: (...args: any[]) => console.log(`[PowerSync]`, ...args),
  error: (...args: any[]) => console.error(`[PowerSync]`, ...args),
};

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
  log.info("Initializing local SQLite database...");
  await db.init();
  log.info("Local database ready");
};

/** Phase 2: Connect to PowerSync cloud — runs in background, doesn't block UI. */
export const connectCloud = async () => {
  if (isCloudConnected || typeof window === 'undefined') return;
  isCloudConnected = true;
  log.info("Connecting to PowerSync cloud...");
  const connector = new SupabaseConnector();
  await db.connect(connector, {
    crudUploadThrottleMs: 2000,
    retryDelayMs: 5000
  });
  log.info("Cloud connection established");
};

/** Delete local SQLite database and re-sync all data from the cloud. */
export const resetLocalDatabase = async () => {
  if (typeof window === 'undefined') return;
  log.info("Resetting local database...");
  // Disconnect from cloud sync
  await db.disconnect();
  log.info("Disconnected from cloud");
  // Delete all local data
  await db.disconnectAndClear();
  log.info("Local data cleared");
  // Reset flags so we can re-initialize
  isLocalReady = false;
  isCloudConnected = false;
  // Re-initialize
  await initLocal();
  await connectCloud();
  log.info("Reset complete — re-syncing from cloud");
};
