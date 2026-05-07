"use client";

import { useState } from "react";
import { useQuery } from "@powersync/react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, CheckCircle2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTagColorClasses, getTagDotClass } from "@/lib/colors";
import { Tag } from "@/lib/powersync/AppSchema";
import { createTag } from "@/lib/tags";
import { getDueDateInfo } from "@/lib/tasks";
import { cn } from "@/lib/utils";

interface TaskMetadataEditorProps {
  dueDate: Date | undefined;
  onDueDateChange: (date: Date | undefined) => void;
  selectedTagIds: string[];
  onSelectedTagIdsChange: (tagIds: string[]) => void;
  density?: "compact" | "default";
  dueDateFormat?: string;
  className?: string;
  selectedTagsClassName?: string;
}

const VARIANTS = {
  compact: {
    row: "mt-0.5 pb-0.5",
    dueTrigger: "h-6 px-1.5 -ml-1.5 text-xs",
    tagTrigger: "h-6 px-1.5 text-xs",
    tagPopoverWidth: "w-[200px]",
    selectedTags: "mt-0.5",
  },
  default: {
    row: "mt-4",
    dueTrigger: "h-8 px-2 text-xs border border-transparent",
    tagTrigger: "h-8 px-2 text-xs border border-transparent",
    tagPopoverWidth: "w-[220px]",
    selectedTags: "mt-3",
  },
} as const;

export function TaskMetadataEditor({
  dueDate,
  onDueDateChange,
  selectedTagIds,
  onSelectedTagIdsChange,
  density = "compact",
  dueDateFormat = "PPP",
  className,
  selectedTagsClassName,
}: TaskMetadataEditorProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const { data: allTags = [] } = useQuery("SELECT * FROM tags ORDER BY name ASC");

  const variant = VARIANTS[density];
  const dueDateInfo = getDueDateInfo(dueDate);

  const handleCreateInlineTag = async () => {
    const tagName = tagSearchQuery.trim();
    if (!tagName) return;

    const newId = await createTag(tagName, undefined, tagName);
    onSelectedTagIdsChange(
      selectedTagIds.includes(newId) ? selectedTagIds : [...selectedTagIds, newId]
    );
    setTagSearchQuery("");
  };

  const handleToggleTag = (tagId: string) => {
    onSelectedTagIdsChange(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId]
    );
  };

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-1.5", variant.row, className)}>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger
            className={cn(
              "flex items-center justify-start text-left font-normal hover:bg-accent hover:text-accent-foreground rounded-md transition-colors shrink-0 whitespace-nowrap",
              variant.dueTrigger,
              !dueDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            {dueDate ? format(dueDate, dueDateFormat) : <span>Pick a date</span>}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={(date) => {
                onDueDateChange(date);
                setIsCalendarOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {dueDateInfo.show && (
          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm ${dueDateInfo.bg} ${dueDateInfo.text} whitespace-nowrap shrink-0 cursor-pointer transition-opacity hover:opacity-85`}
          >
            {dueDateInfo.label}
          </button>
        )}

        <Popover open={isTagSelectorOpen} onOpenChange={setIsTagSelectorOpen}>
          <PopoverTrigger
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground text-muted-foreground shrink-0 rounded-md",
              variant.tagTrigger
            )}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Tag
          </PopoverTrigger>
          <PopoverContent className={cn(variant.tagPopoverWidth, "p-0")} align="start">
            <Command>
              <CommandInput
                placeholder="Search tags..."
                className="h-9"
                value={tagSearchQuery}
                onValueChange={setTagSearchQuery}
              />
              <CommandList>
                <CommandEmpty>
                  {tagSearchQuery.trim() ? (
                    <div
                      className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent flex items-center gap-2"
                      onClick={handleCreateInlineTag}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create &quot;{tagSearchQuery}&quot;
                    </div>
                  ) : "No tags found."}
                </CommandEmpty>
                <CommandGroup>
                  {allTags.map((tag: Tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <CommandItem key={tag.id} onSelect={() => handleToggleTag(tag.id)}>
                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                        <div className={cn("h-3 w-3 rounded-full mr-2", getTagDotClass(tag.color || "slate"))} />
                        <span>{tag.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedTagIds.length > 0 && (
        <div className={cn("flex flex-wrap gap-1.5", variant.selectedTags, selectedTagsClassName)}>
          {selectedTagIds.map((tagId) => {
            const tag = allTags.find((entry: Tag) => entry.id === tagId);
            if (!tag) return null;

            return (
              <Badge
                key={tag.id}
                variant="secondary"
                className={cn("px-1.5 py-0 h-5 text-[10px] font-medium gap-1 rounded-sm shadow-none", getTagColorClasses(tag.color || "slate"))}
              >
                {tag.name}
              </Badge>
            );
          })}
        </div>
      )}
    </>
  );
}