"use client";

import { useStatus } from "@powersync/react";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, CloudUpload, Check } from "lucide-react";

/**
 * A small sync status indicator light for the header.
 * - Green dot + check: connected and synced
 * - Orange pulsing dot + upload icon: uploading changes
 * - Red dot + wifi-off: offline, edits stored locally
 */
export function SyncIndicator() {
  const status = useStatus();

  const isConnected = status.connected;
  const isUploading = status.dataFlowStatus?.uploading ?? false;
  const isDownloading = status.dataFlowStatus?.downloading ?? false;
  const isSyncing = isUploading || isDownloading;

  let dotColor = "bg-emerald-500"; // synced
  let label = "Synced";
  let Icon = Check;

  if (!isConnected) {
    dotColor = "bg-rose-500";
    label = "Offline";
    Icon = WifiOff;
  } else if (isSyncing) {
    dotColor = "bg-amber-500";
    label = isUploading ? "Syncing..." : "Downloading...";
    Icon = CloudUpload;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={label}>
      <div className="relative flex items-center justify-center">
        <div className={cn("h-2 w-2 rounded-full transition-colors", dotColor)} />
        {isSyncing && (
          <div className={cn("absolute h-2 w-2 rounded-full animate-ping", dotColor, "opacity-75")} />
        )}
      </div>
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
