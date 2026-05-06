"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Info, Logs, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export function LogViewerDialog({ open, onOpenChange }: LogViewerDialogProps) {
  const [logs, setLogs] = useState(() => getRecentLogs());

  useEffect(() => {
    setLogs(getRecentLogs());
    return subscribeToLogs(() => setLogs(getRecentLogs()));
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border border-border/60 bg-background p-0 shadow-[0_20px_80px_-30px_rgba(0,0,0,0.45)] sm:max-h-[min(90dvh,52rem)] sm:max-w-4xl" showCloseButton={false}>
        <DialogHeader className="relative overflow-hidden border-b border-border/60 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-sky-500)_10%,transparent),transparent_40%,color-mix(in_srgb,var(--color-emerald-500)_10%,transparent))] px-5 pt-5 pb-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--color-sky-500)_16%,transparent),transparent_42%),radial-gradient(circle_at_bottom_right,color-mix(in_srgb,var(--color-emerald-500)_14%,transparent),transparent_38%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Session Diagnostics
              </div>
              <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
                  <Logs className="h-5 w-5 text-foreground" />
                </span>
                Recent Logs
              </DialogTitle>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-right shadow-sm backdrop-blur-sm">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Buffer</div>
              <div className="text-lg font-semibold text-foreground">{logs.length}<span className="text-sm text-muted-foreground">/50</span></div>
            </div>
          </div>

          <DialogDescription>
            In-memory viewer for the latest 50 logger entries in this browser session.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto bg-[linear-gradient(180deg,transparent,rgba(127,127,127,0.03))] px-4 py-4 sm:px-5">
          {logs.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-border/70 bg-card/40 px-6 py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-sm">
                <Logs className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-base font-semibold text-foreground">No logs captured yet</div>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                When the enabled logger emits entries in this browser session, the latest 50 will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {logs.map((log) => (
                <div key={log.id} className="rounded-[1.35rem] border border-border/70 bg-card/85 p-3.5 shadow-[0_10px_30px_-22px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-colors hover:border-border hover:bg-card">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("flex h-9 w-9 items-center justify-center rounded-2xl border", levelClassName[log.level])}>
                        {(() => {
                          const Icon = levelIcon[log.level];
                          return <Icon className="h-4 w-4" />;
                        })()}
                      </span>
                      <div>
                        <div className="text-sm font-semibold capitalize text-foreground">{log.level}</div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Log Entry</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] font-medium text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground/80">{new Date(log.timestamp).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-background/80 px-3.5 py-3 font-mono text-[12px] leading-5 text-foreground whitespace-pre-wrap break-words">
                    {log.message}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter showCloseButton className="mx-0 mb-0 border-t border-border/60 bg-card/40 backdrop-blur-sm" />
      </DialogContent>
    </Dialog>
  );
}