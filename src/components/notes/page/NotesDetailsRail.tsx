"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Files, Hash, Link2, Orbit, Paperclip } from "lucide-react";

import type { LinkedNoteReferenceRow, NoteAttachmentRow, NotePageRow, NoteTagMentionRow } from "@/hooks/use-notes";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/shared/utils";

import { attachmentLabel } from "./utils";
import { Bone, DetailsRailCardSkeleton, DetailsSection } from "./ui";
import type { NoteTag, OutlineEntry } from "./types";

type TimestampLabel = {
  relative: string;
  dateOnly: string;
  absolute: string;
} | null;

type DetailsSectionState = {
  outline: boolean;
  summary: boolean;
  references: boolean;
  mentions: boolean;
  attachments: boolean;
};

type DetailsRailView = "overview" | "connections";

export function NotesDetailsRail({
  selectedPage,
  detailsSectionOpen,
  pageOutline,
  summaryDraft,
  selectedTagIdsDraft,
  linkedReferences,
  pageTagMentions,
  selectedPageAttachments,
  createdTimestamp,
  isLoadingLinkedReferences,
  isLoadingTagMentions,
  isLoadingAttachments,
  onToggleDetailsSection,
  onSetSummaryDraft,
  onPersistSelectedPageProperties,
  onSetFocusTarget,
}: {
  selectedPage: NotePageRow | null;
  detailsSectionOpen: DetailsSectionState;
  pageOutline: OutlineEntry[];
  summaryDraft: string;
  selectedTagIdsDraft: string[];
  linkedReferences: LinkedNoteReferenceRow[];
  pageTagMentions: NoteTagMentionRow[];
  selectedPageAttachments: NoteAttachmentRow[];
  createdTimestamp: TimestampLabel;
  isLoadingLinkedReferences: boolean;
  isLoadingTagMentions: boolean;
  isLoadingAttachments: boolean;
  onToggleDetailsSection: (section: keyof DetailsSectionState) => void;
  onSetSummaryDraft: (value: string) => void;
  onPersistSelectedPageProperties: (summary: string, tagIds: string[]) => void;
  onSetFocusTarget: (target: { blockId: string; placement: "start" | "end" }) => void;
}) {
  const [activeView, setActiveView] = useState<DetailsRailView>("overview");
  const [visibleView, setVisibleView] = useState<DetailsRailView>("overview");
  const [transitionStage, setTransitionStage] = useState<"idle" | "exiting" | "entering">("idle");
  const exitTimerRef = useRef<number | null>(null);
  const enterFrameRef = useRef<number | null>(null);

  const clearTransitionHandles = () => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (enterFrameRef.current !== null) {
      window.cancelAnimationFrame(enterFrameRef.current);
      enterFrameRef.current = null;
    }
  };

  const handleViewChange = (nextView: DetailsRailView) => {
    if (nextView === activeView) {
      return;
    }

    clearTransitionHandles();
    setActiveView(nextView);
    setTransitionStage("exiting");

    exitTimerRef.current = window.setTimeout(() => {
      setVisibleView(nextView);
      setTransitionStage("entering");
      enterFrameRef.current = window.requestAnimationFrame(() => {
        setTransitionStage("idle");
        enterFrameRef.current = null;
      });
      exitTimerRef.current = null;
    }, 140);
  };

  useEffect(() => clearTransitionHandles, []);

  const overviewContent = (
    <div className="space-y-4">
      <section className="border-t border-border/30 pt-4 first:border-t-0 first:pt-0">
        <div className="flex w-full items-center justify-between gap-4 rounded-full bg-muted/70 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">CREATED</p>
            <p className="text-[12px] font-semibold text-foreground">{createdTimestamp?.relative ?? "Unknown"}</p>
          </div>
                <p className="shrink-0 self-center text-right text-[11px] font-medium leading-none text-muted-foreground">{createdTimestamp?.absolute ?? "Created date unavailable"}</p>
        </div>
      </section>

      <DetailsSection
        title="Outline"
        icon={Files}
        accentClassName="bg-slate-500/12 text-slate-700 dark:bg-slate-500/18 dark:text-slate-300"
        isOpen={detailsSectionOpen.outline}
        onToggle={() => onToggleDetailsSection("outline")}
      >
        {pageOutline.length === 0 ? (
          <p className="text-[11px] leading-5 text-muted-foreground">No headings yet.</p>
        ) : (
          <div className="space-y-1 animate-stagger">
            {pageOutline.map((entry, index) => (
              <button
                key={`${entry.blockId}-${index}`}
                type="button"
                onClick={() => onSetFocusTarget({ blockId: entry.blockId, placement: "start" })}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
                style={{ paddingLeft: `${8 + entry.indentLevel * 10}px` }}
              >
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">H{entry.level}</span>
                <span className="truncate">{entry.text}</span>
              </button>
            ))}
          </div>
        )}
      </DetailsSection>

      <DetailsSection
        title="Summary"
        icon={FileText}
        accentClassName="bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300"
        isOpen={detailsSectionOpen.summary}
        onToggle={() => onToggleDetailsSection("summary")}
      >
        <Textarea
          value={summaryDraft}
          onChange={(event) => {
            onSetSummaryDraft(event.target.value);
            onPersistSelectedPageProperties(event.target.value, selectedTagIdsDraft);
          }}
          rows={4}
          placeholder="Add page context"
          className="min-h-24 rounded-xl border-0 bg-muted/60 px-3 py-2.5 text-[12px] leading-5 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
        />
      </DetailsSection>
    </div>
  );

  const connectionsContent = (
    <div className="space-y-4">
      <DetailsSection
        title="Linked references"
        icon={Link2}
        accentClassName="bg-sky-500/12 text-sky-700 dark:bg-sky-500/18 dark:text-sky-300"
        isOpen={detailsSectionOpen.references}
        onToggle={() => onToggleDetailsSection("references")}
      >
        {isLoadingLinkedReferences ? (
          <div className="space-y-2 animate-stagger">
            <DetailsRailCardSkeleton lines={2} />
            <DetailsRailCardSkeleton lines={3} />
            <DetailsRailCardSkeleton lines={2} />
          </div>
        ) : linkedReferences.length === 0 ? (
          <p className="text-[11px] leading-5 text-muted-foreground">No incoming references.</p>
        ) : (
          <div className="space-y-2 animate-stagger">
            {linkedReferences.slice(0, 8).map((reference) => (
              <div key={`${reference.source_block_id}-${reference.source_page_id}`} className="px-0 py-1">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground"><FileText className="h-3 w-3 text-muted-foreground" />{reference.source_page_title || "Untitled page"}</p>
                <p className="mt-1 line-clamp-3 text-[10px] leading-5 text-muted-foreground">{reference.source_block_content ? JSON.parse(reference.source_block_content).content?.[0]?.content?.[0]?.text ?? "Referenced block" : "Referenced block"}</p>
              </div>
            ))}
          </div>
        )}
      </DetailsSection>

      <DetailsSection
        title="Tag mentions"
        icon={Hash}
        accentClassName="bg-violet-500/12 text-violet-700 dark:bg-violet-500/18 dark:text-violet-300"
        isOpen={detailsSectionOpen.mentions}
        onToggle={() => onToggleDetailsSection("mentions")}
      >
        {isLoadingTagMentions ? (
          <div className="flex flex-wrap gap-2 animate-stagger">
            <Bone className="h-6 w-20 rounded-full" />
            <Bone className="h-6 w-16 rounded-full" />
            <Bone className="h-6 w-24 rounded-full" />
          </div>
        ) : pageTagMentions.length === 0 ? (
          <p className="text-[11px] leading-5 text-muted-foreground">No inline tags.</p>
        ) : (
          <div className="flex flex-wrap gap-2 animate-stagger">
            {pageTagMentions.map((tag) => (
              <span
                key={tag.tag_name}
                className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
              >
                #{tag.tag_name} · {tag.mention_count}
              </span>
            ))}
          </div>
        )}
      </DetailsSection>

      <DetailsSection
        title="Attachments"
        icon={Paperclip}
        accentClassName="bg-cyan-500/12 text-cyan-700 dark:bg-cyan-500/18 dark:text-cyan-300"
        isOpen={detailsSectionOpen.attachments}
        onToggle={() => onToggleDetailsSection("attachments")}
      >
        {isLoadingAttachments ? (
          <div className="space-y-2 animate-stagger">
            <DetailsRailCardSkeleton lines={1} />
            <DetailsRailCardSkeleton lines={1} />
          </div>
        ) : selectedPageAttachments.length === 0 ? (
          <p className="text-[11px] leading-5 text-muted-foreground">No attachments yet.</p>
        ) : (
          <div className="space-y-2 animate-stagger">
            {selectedPageAttachments.slice(0, 6).map((attachment) => (
              <div key={attachment.id} className="px-0 py-1">
                <p className="truncate text-[11px] font-medium text-foreground">{attachmentLabel(attachment.file_path)}</p>
                <p className="mt-1 truncate text-[10px] leading-5 text-muted-foreground">
                  {attachment.sync_state ?? "local"}
                  {attachment.file_path ? ` · ${attachment.file_path}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </DetailsSection>
    </div>
  );

  if (!selectedPage) {
    return null;
  }

  return (
    <div className="animate-fade-slide-in space-y-4 py-1 sm:flex sm:h-full sm:min-h-0 sm:flex-1 sm:flex-col sm:gap-4 sm:space-y-0 sm:overflow-hidden">
      <div className="space-y-4 pr-1 pb-4 transition-smooth sm:min-h-0 sm:flex-1 sm:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <p className="text-sm font-semibold text-foreground">Details</p>
        </div>

        <div className="inline-flex w-full rounded-xl bg-muted/90 p-1 text-[12px] font-medium text-muted-foreground">
          {([
            ["overview", "Overview", FileText, "text-amber-700 dark:text-amber-300", "bg-amber-500/12 ring-amber-500/25 dark:bg-amber-400/12"],
            ["connections", "Connections", Orbit, "text-sky-700 dark:text-sky-300", "bg-sky-500/12 ring-sky-500/25 dark:bg-sky-400/12"],
          ] as const).map(([view, label, Icon, iconClassName, activeClassName]) => (
            <button
              key={view}
              type="button"
              onClick={() => handleViewChange(view)}
              className={`flex-1 rounded-lg px-3 py-1.5 transition-smooth ${activeView === view ? `text-foreground shadow-sm ring-1 ${activeClassName}` : "hover:text-foreground"}`}
              aria-pressed={activeView === view}
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${activeView === view ? iconClassName : "text-muted-foreground/80"}`} />
                <span>{label}</span>
              </span>
            </button>
          ))}
        </div>

        <div
          className={cn(
            "transition-all ease-out motion-reduce:transition-none",
            transitionStage === "exiting" && "-translate-y-0.5 opacity-0 duration-110",
            transitionStage === "entering" && "-translate-y-1 opacity-0 duration-0",
            transitionStage === "idle" && "translate-y-0 opacity-100 duration-180"
          )}
        >
          {visibleView === "overview" ? overviewContent : connectionsContent}
        </div>
      </div>
    </div>
  );
}
