"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@powersync/react";
import { FileText, Network, Database, ArrowRight } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { getApp } from "@/lib/apps";

const notesApp = getApp("notes");

type CountRow = { count: number };
type RecentPageRow = {
  id: string;
  title: string | null;
  properties: string | null;
  updated_at: string | null;
};

function parseProperties(raw: string | null) {
  if (!raw) return {} as Record<string, unknown>;

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

export default function NotesPage() {
  const { data: pageCountRows = [], isLoading: isLoadingPageCount } = useQuery<CountRow>(
    "SELECT COUNT(*) AS count FROM pages"
  );
  const { data: blockCountRows = [], isLoading: isLoadingBlockCount } = useQuery<CountRow>(
    "SELECT COUNT(*) AS count FROM blocks"
  );
  const { data: recentPages = [], isLoading: isLoadingRecentPages } = useQuery<RecentPageRow>(
    [
      "SELECT id, title, properties, updated_at",
      "FROM pages",
      "ORDER BY updated_at DESC, created_at DESC",
      "LIMIT 8",
    ].join(" ")
  );

  const pageCount = String(pageCountRows[0]?.count ?? 0);
  const blockCount = String(blockCountRows[0]?.count ?? 0);

  const normalizedPages = useMemo(
    () =>
      recentPages.map((page) => {
        const properties = parseProperties(page.properties);
        const summary = typeof properties.summary === "string" ? properties.summary : null;
        const tags = Array.isArray(properties.tags)
          ? properties.tags.filter((tag): tag is string => typeof tag === "string")
          : [];

        return {
          ...page,
          summary,
          tags,
        };
      }),
    [recentPages]
  );

  const isLoading = isLoadingPageCount || isLoadingBlockCount || isLoadingRecentPages;

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      <AppHeader app={notesApp} />

      <main className="flex-1 overflow-y-auto overflow-x-hidden px-[var(--app-gutter-x)] py-4 pb-[var(--mobile-bottom-fab-clearance)] sm:pb-4 md:py-8 md:pb-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={FileText} label="Pages" value={pageCount} />
            <StatCard icon={Database} label="Blocks" value={blockCount} />
            <StatCard icon={Network} label="Graph Edges" value="Pending" />
            <StatCard icon={ArrowRight} label="Editor" value="Phase 2" />
          </section>

          <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <aside className="rounded-3xl border border-border bg-card/70 p-4 shadow-sm">
              <p className="text-sm font-medium text-foreground">Notes module</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The shell, local schema, and PowerSync wiring are in place. The next slice adds the editor core,
                block reordering, and graph reconciliation on top of the local SQLite model.
              </p>
            </aside>

            <section className="rounded-3xl border border-border bg-card/70 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">Recent pages</h2>
                  <p className="text-sm text-muted-foreground">Read from local SQLite through PowerSync.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                    Loading local notes data…
                  </div>
                ) : normalizedPages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                    No note pages yet. Apply the notes migration and create your first page once the editor slice lands.
                  </div>
                ) : (
                  normalizedPages.map((page) => (
                    <Link
                      key={page.id}
                      href={`/notes?page=${page.id}`}
                      className="block rounded-2xl border border-border bg-background/80 px-4 py-3 transition-colors hover:bg-accent"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{page.title || "Untitled page"}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {page.summary || "Properties are stored as JSON and available for future cover image and metadata UI."}
                          </p>
                        </div>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      {page.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {page.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </Link>
                  ))
                )}
              </div>
            </section>

            <aside className="hidden rounded-3xl border border-border bg-card/70 p-4 shadow-sm xl:block">
              <h2 className="text-sm font-medium text-foreground">Implementation status</h2>
              <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
                <li>Schema and PowerSync local tables are ready.</li>
                <li>Shared app shell registration is complete.</li>
                <li>Editor core, graph nodes, and task blocks are next.</li>
              </ul>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}