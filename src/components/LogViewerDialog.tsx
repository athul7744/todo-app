"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Info, Logs, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getRecentLogs, subscribeToLogs, type LogEntry } from "@/lib/logger";

interface LogViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const levelClassName: Record<LogEntry['level'], string> = {
  info: "border-sky-200/80 bg-sky-100/80 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/12 dark:text-sky-200",
  warn: "border-amber-200/80 bg-amber-100/80 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/12 dark:text-amber-200",
  error: "border-rose-200/80 bg-rose-100/80 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/12 dark:text-rose-200",
};

const levelIcon = {
  info: Info,
  warn: AlertTriangle,
  error: Activity,
} satisfies Record<LogEntry["level"], typeof Info>;

const toneClassName: Record<LogEntry["level"], string> = {
  info: "text-sky-700 dark:text-sky-300",
  warn: "text-amber-700 dark:text-amber-300",
  error: "text-rose-700 dark:text-rose-300",
};

const LogRow = memo(function LogRow({ log }: { log: LogEntry }) {
  const timestamp = new Date(log.timestamp);

  return (
    <article className="px-4 py-2.5" style={{ contentVisibility: "auto", containIntrinsicSize: "76px" }}>
      <div className="min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <span className={cn("pt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]", toneClassName[log.level])}>{log.level}</span>
          <span className="shrink-0 pt-0.5 text-[10px] text-muted-foreground/80">
            {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            <span className="mx-1 text-border">/</span>
            {timestamp.toLocaleDateString()}
          </span>
        </div>

        <pre className="overflow-x-auto font-[family:var(--font-geist-mono)] text-[11.5px] leading-5 tracking-[0.01em] text-foreground whitespace-pre-wrap break-words">
          {log.message}
        </pre>
      </div>
    </article>
  );
});

export function LogViewerDialog({ open, onOpenChange }: LogViewerDialogProps) {
  const [logs, setLogs] = useState(() => getRecentLogs());

  useEffect(() => {
    setLogs(getRecentLogs());
    return subscribeToLogs(() => setLogs(getRecentLogs()));
  }, []);

  const counts = useMemo(() => {
    return logs.reduce(
      (summary, log) => {
        summary[log.level] += 1;
        return summary;
      },
      { info: 0, warn: 0, error: 0 }
    );
  }, [logs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border border-border bg-background p-0 shadow-[0_18px_60px_-28px_rgba(0,0,0,0.4)] sm:max-h-[min(90dvh,52rem)] sm:max-w-4xl" showCloseButton={false}>
        <DialogHeader className="border-b border-border bg-background px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Session Diagnostics
              </div>
              <DialogTitle className="flex items-center gap-3 text-lg font-bold sm:text-xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 shadow-sm dark:bg-sky-500/20 dark:text-sky-400">
                  <Logs className="h-5 w-5" />
                </span>
                <span className="font-bold tracking-tight">
                  Logger
                  <span className="text-sky-600 dark:text-sky-400">.</span>
                </span>
              </DialogTitle>
            </div>

            <div className="rounded-xl border border-border bg-card px-3 py-2 text-right shadow-sm">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Buffer</div>
              <div className="text-lg font-semibold text-foreground">{logs.length}<span className="text-sm text-muted-foreground">/50</span></div>
              <div className="mt-1 flex items-center justify-end gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  {counts.info}
                </span>
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  {counts.warn}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  {counts.error}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto bg-muted/20 px-4 py-4 sm:px-5" style={{ WebkitOverflowScrolling: "touch" }}>
          {logs.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center shadow-sm">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-background shadow-sm">
                <Logs className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-base font-semibold text-foreground">No logs captured yet</div>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                When the enabled logger emits entries in this browser session, the latest 50 will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-background divide-y divide-border/70">
              {logs.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>

        <DialogFooter showCloseButton className="mx-0 mb-0 border-t border-border bg-background" />
      </DialogContent>
    </Dialog>
  );
}