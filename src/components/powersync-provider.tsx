"use client"

import React, { useEffect, useState } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { db, initLocal, connectCloud } from '@/lib/powersync/db';

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const [localReady, setLocalReady] = useState(false);

  useEffect(() => {
    // Phase 1: Open local DB (fast, ~50ms) → render UI with cached data
    initLocal()
      .then(() => {
        setLocalReady(true);
        // Phase 2: Connect to cloud in background — doesn't block UI
        connectCloud().catch((err) =>
          console.error("PowerSync cloud connect failed:", err)
        );
      })
      .catch((err) => console.error("Failed to initialize local DB:", err));
  }, []);

  if (!localReady) {
    return <div className="flex flex-col items-center justify-center min-h-screen text-muted-foreground animate-pulse">Loading...</div>;
  }

  return (
    <PowerSyncContext.Provider value={db}>
      {children}
    </PowerSyncContext.Provider>
  );
}
