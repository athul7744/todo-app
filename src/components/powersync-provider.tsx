"use client"

import React, { useEffect, useState } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { db, initPowerSync } from '@/lib/powersync/db';

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initPowerSync()
      .then(() => setInitialized(true))
      .catch((err) => console.error("Failed to initialize PowerSync:", err));
  }, []);

  if (!initialized) {
    return <div className="flex flex-col items-center justify-center min-h-screen text-muted-foreground animate-pulse">Initializing local database...</div>;
  }

  return (
    <PowerSyncContext.Provider value={db}>
      {children}
    </PowerSyncContext.Provider>
  );
}
