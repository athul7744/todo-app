"use client";

import { useStatus } from "@powersync/react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { WifiOff, CloudUpload, CloudDownload } from "lucide-react";

/**
 * Formats a date as a relative time string like "just now", "2m ago", "1h ago"
 */
function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SyncIndicator() {
  const status = useStatus();
  const [showSyncedFlash, setShowSyncedFlash] = useState(false);
  const [, forceUpdate] = useState(0);
  const wasSyncingRef = useRef(false);

  const isConnected = status.connected;
  const isUploading = status.dataFlowStatus?.uploading ?? false;
  const isDownloading = status.dataFlowStatus?.downloading ?? false;
  const isSyncing = isUploading || isDownloading;
  const lastSyncedAt = status.lastSyncedAt;

  // Detect sync completion → flash "Synced" for 2s
  useEffect(() => {
    if (wasSyncingRef.current && !isSyncing && isConnected) {
      setShowSyncedFlash(true);
      const timer = setTimeout(() => setShowSyncedFlash(false), 2000);
      return () => clearTimeout(timer);
    }
    wasSyncingRef.current = isSyncing;
  }, [isSyncing, isConnected]);

  // Tick every 30s to update relative time
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  let dotColor = "bg-emerald-500";
  let label = lastSyncedAt ? formatRelativeTime(lastSyncedAt) : "Connected";
  let Icon: React.ElementType | null = null;

  if (!isConnected) {
    dotColor = "bg-rose-500";
    label = "Offline";
    Icon = WifiOff;
  } else if (isSyncing) {
    dotColor = "bg-amber-500";
    if (isUploading) {
      label = "Uploading";
      Icon = CloudUpload;
    } else {
      label = "Downloading";
      Icon = CloudDownload;
    }
  } else if (showSyncedFlash) {
    label = "Synced";
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground transition-all duration-500 ease-out" title={label}>
      <div className="relative flex items-center justify-center">
        <div className={cn("h-2 w-2 rounded-full transition-colors duration-700 ease-out", dotColor)} />
        {isSyncing && (
          <div className={cn("absolute h-2 w-2 rounded-full animate-gentle-pulse", dotColor)} />
        )}
      </div>
      {Icon && <Icon className="h-3 w-3 transition-opacity duration-300" />}
      <span className="transition-opacity duration-300">{label}</span>
    </div>
  );
}
