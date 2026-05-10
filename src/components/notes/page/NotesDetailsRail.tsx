"use client";

import { Copy, Clock3, FileText, Files, Hash, Link2, Loader2, Paperclip, Settings2, Tags, Trash2 } from "lucide-react";

import type { LinkedNoteReferenceRow, NoteAttachmentRow, NoteBlockRow, NotePageRow, NoteTagMentionRow } from "@/hooks/use-notes";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { attachmentLabel } from "./utils";
import { Bone, DetailsRailCardSkeleton, DetailsSection } from "./ui";
import type { OutlineEntry } from "./types";

type TimestampLabel = {
  relative: string;
  absolute: string;
} | null;

type DetailsSectionState = {
  outline: boolean;
  summary: boolean;
  tags: boolean;
  references: boolean;
  mentions: boolean;
  attachments: boolean;
  timestamps: boolean;
  actions: boolean;
};

export function NotesDetailsRail({
  selectedPage,
  detailsSectionOpen,
  pageOutline,
  summaryDraft,
  tagsDraft,
  linkedReferences,
  pageTagMentions,
  selectedPageAttachments,
  selectedBlocks,
  createdTimestamp,
  isLoadingLinkedReferences,
  isLoadingTagMentions,
  isLoadingAttachments,
  isDeleteDialogOpen,
  isDeletingPage,
  areAllDetailsSectionsOpen,
  onToggleAllDetailsSections,
  onToggleDetailsSection,
  onSetSummaryDraft,
  onSetTagsDraft,
  onPersistSelectedPageProperties,
  onSetFocusTarget,
  onOpenDeleteDialog,
  onOpenChangeDeleteDialog,
  onHandleDeletePage,
  onHandleCopyDocument,
}: {
  selectedPage: NotePageRow | null;
  detailsSectionOpen: DetailsSectionState;
  pageOutline: OutlineEntry[];
  summaryDraft: string;
  tagsDraft: string;
  linkedReferences: LinkedNoteReferenceRow[];
  pageTagMentions: NoteTagMentionRow[];
  selectedPageAttachments: NoteAttachmentRow[];
  selectedBlocks: NoteBlockRow[];
  createdTimestamp: TimestampLabel;
  isLoadingLinkedReferences: boolean;
  isLoadingTagMentions: boolean;
  isLoadingAttachments: boolean;
  isDeleteDialogOpen: boolean;
  isDeletingPage: boolean;
  areAllDetailsSectionsOpen: boolean;
  onToggleAllDetailsSections: () => void;
  onToggleDetailsSection: (section: keyof DetailsSectionState) => void;
  onSetSummaryDraft: (value: string) => void;
  onSetTagsDraft: (value: string) => void;
  onPersistSelectedPageProperties: (summary: string, tags: string) => void;
  onSetFocusTarget: (target: { blockId: string; placement: "start" | "end" }) => void;
  onOpenDeleteDialog: () => void;
  onOpenChangeDeleteDialog: (open: boolean) => void;
  onHandleDeletePage: () => void;
  onHandleCopyDocument: () => void | Promise<void>;
}) {
  if (!selectedPage) {
    return null;
  }

  return (
    <div className="animate-fade-slide-in space-y-4 py-1 sm:flex sm:h-full sm:min-h-0 sm:flex-1 sm:flex-col sm:gap-4 sm:space-y-0 sm:overflow-hidden">
      <div className="space-y-4 pr-1 pb-4 transition-smooth sm:min-h-0 sm:flex-1 sm:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <p className="text-sm font-semibold text-foreground">Details</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleAllDetailsSections}
            className="h-8 rounded-full px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            {areAllDetailsSectionsOpen ? "Collapse all" : "Expand all"}
          </Button>
        </div>

        <DetailsSection
          title="Outline"
          icon={Files}
          accentClassName="bg-slate-500/12 text-slate-700 dark:bg-slate-500/18 dark:text-slate-300"
          isOpen={detailsSectionOpen.outline}
          onToggle={() => onToggleDetailsSection("outline")}
        >
          {pageOutline.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Files className="h-3.5 w-3.5" />No headings yet.</p>
          ) : (
            <div className="mt-2 space-y-1 animate-stagger">
              {pageOutline.map((entry, index) => (
                <button
                  key={`${entry.blockId}-${index}`}
                  type="button"
                  onClick={() => onSetFocusTarget({ blockId: entry.blockId, placement: "start" })}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-foreground transition-smooth hover:bg-accent"
                  style={{ paddingLeft: `${12 + (entry.level - 1) * 12}px` }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">H{entry.level}</span>
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
              onPersistSelectedPageProperties(event.target.value, tagsDraft);
            }}
            rows={4}
            placeholder="Add page context"
            className="min-h-24 rounded-xl border-0 bg-muted/95 px-3 py-2.5 text-[13px] leading-5 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
          />
        </DetailsSection>

        <DetailsSection
          title="Tags"
          icon={Tags}
          accentClassName="bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
          isOpen={detailsSectionOpen.tags}
          onToggle={() => onToggleDetailsSection("tags")}
        >
          <Input
            value={tagsDraft}
            onChange={(event) => {
              onSetTagsDraft(event.target.value);
              onPersistSelectedPageProperties(summaryDraft, event.target.value);
            }}
            placeholder="comma, separated, tags"
            className="h-10 rounded-xl border-0 bg-muted/95 px-3 text-[13px] shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
          />
        </DetailsSection>

        <DetailsSection
          title="Linked references"
          icon={Link2}
          accentClassName="bg-sky-500/12 text-sky-700 dark:bg-sky-500/18 dark:text-sky-300"
          isOpen={detailsSectionOpen.references}
          onToggle={() => onToggleDetailsSection("references")}
        >
          {isLoadingLinkedReferences ? (
            <div className="mt-2 space-y-2 animate-stagger">
              <DetailsRailCardSkeleton lines={2} />
              <DetailsRailCardSkeleton lines={3} />
              <DetailsRailCardSkeleton lines={2} />
            </div>
          ) : linkedReferences.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Link2 className="h-3.5 w-3.5" />No incoming references.</p>
          ) : (
            <div className="mt-2 space-y-2 animate-stagger">
              {linkedReferences.slice(0, 8).map((reference) => (
                <div key={`${reference.source_block_id}-${reference.source_page_id}`} className="rounded-xl bg-muted/95 px-3 py-2.5 transition-smooth">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground"><FileText className="h-3 w-3 text-muted-foreground" />{reference.source_page_title || "Untitled page"}</p>
                  <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-muted-foreground">{reference.source_block_content ? JSON.parse(reference.source_block_content).content?.[0]?.content?.[0]?.text ?? "Referenced block" : "Referenced block"}</p>
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
            <div className="mt-2 flex flex-wrap gap-2 animate-stagger">
              <Bone className="h-7 w-24 rounded-full" />
              <Bone className="h-7 w-20 rounded-full" />
              <Bone className="h-7 w-28 rounded-full" />
            </div>
          ) : pageTagMentions.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Hash className="h-3.5 w-3.5" />No inline tags.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2 animate-stagger">
              {pageTagMentions.map((tag) => (
                <span
                  key={tag.tag_name}
                  className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-smooth dark:bg-amber-500/20 dark:text-amber-300"
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
            <div className="mt-2 space-y-2 animate-stagger">
              <DetailsRailCardSkeleton lines={1} />
              <DetailsRailCardSkeleton lines={1} />
            </div>
          ) : selectedPageAttachments.length === 0 ? (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground"><Paperclip className="h-3.5 w-3.5" />No attachments yet.</p>
          ) : (
            <div className="mt-2 space-y-2 animate-stagger">
              {selectedPageAttachments.slice(0, 6).map((attachment) => (
                <div key={attachment.id} className="rounded-xl bg-muted/95 px-3 py-2.5 transition-smooth">
                  <p className="truncate text-[12px] font-medium text-foreground">{attachmentLabel(attachment.file_path)}</p>
                  <p className="mt-1 truncate text-[11px] leading-5 text-muted-foreground">
                    {attachment.sync_state ?? "local"}
                    {attachment.file_path ? ` · ${attachment.file_path}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DetailsSection>

        <DetailsSection
          title="Timestamps"
          icon={Clock3}
          accentClassName="bg-slate-500/12 text-slate-700 dark:bg-slate-500/18 dark:text-slate-300"
          isOpen={detailsSectionOpen.timestamps}
          onToggle={() => onToggleDetailsSection("timestamps")}
        >
          <div className="overflow-hidden rounded-xl bg-muted/95">
            <div className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Created</p>
                <p className="mt-1 text-[13px] text-foreground">{createdTimestamp?.relative ?? "Unknown"}</p>
              </div>
              <p className="pt-0.5 text-right text-[11px] leading-5 text-muted-foreground">{createdTimestamp?.absolute ?? "No timestamp available"}</p>
            </div>
          </div>
        </DetailsSection>

        <section className="grid grid-cols-2 gap-3 pl-8 text-center animate-stagger">
          <div className="rounded-xl bg-muted/95 px-3 py-3 transition-smooth">
            <p className="text-base font-semibold text-foreground">{selectedBlocks.length}</p>
            <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Files className="h-3 w-3" />Blocks</p>
          </div>
          <div className="rounded-xl bg-muted/95 px-3 py-3 transition-smooth">
            {isLoadingAttachments ? (
              <div className="flex flex-col items-center gap-2">
                <Bone className="h-5 w-8" />
                <Bone className="h-3 w-14" />
              </div>
            ) : (
              <>
                <p className="text-base font-semibold text-foreground">{selectedPageAttachments.length}</p>
                <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Paperclip className="h-3 w-3" />Files</p>
              </>
            )}
          </div>
        </section>

        <DetailsSection
          title="Actions"
          icon={Settings2}
          accentClassName="bg-rose-500/12 text-rose-700 dark:bg-rose-500/18 dark:text-rose-300"
          isOpen={detailsSectionOpen.actions}
          onToggle={() => onToggleDetailsSection("actions")}
        >
          <div className="rounded-xl bg-muted/95 p-3 transition-smooth">
            <Button
              variant="ghost"
              onClick={() => {
                void onHandleCopyDocument();
              }}
              className="h-10 w-full justify-start gap-2 rounded-lg px-3 text-[13px] text-foreground hover:bg-accent hover:text-foreground"
            >
              <Copy className="h-4 w-4" />
              Copy document
            </Button>
            <Button
              variant="ghost"
              onClick={onOpenDeleteDialog}
              className="mt-1 h-10 w-full justify-start gap-2 rounded-lg px-3 text-[13px] text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete page
            </Button>
          </div>
        </DetailsSection>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={onOpenChangeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the page, its blocks, attachments, and local note links. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPage}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onHandleDeletePage}
              disabled={isDeletingPage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete page"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}