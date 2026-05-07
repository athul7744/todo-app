import * as React from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { Plus, Trash2, Tag as TagIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tag } from "@/lib/powersync/AppSchema";
import { cn } from "@/lib/utils";
import { TAG_COLORS, getTagColorClasses, getTagDotClass } from "@/lib/colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createTag } from "@/lib/tags";
import { debouncedExecute } from "@/lib/debounced-update";

type VisibleTag = Omit<Tag, "color"> & {
  color: string | null;
};

function TagRow({
  tag,
  onDelete,
  onUpdateColor,
}: {
  tag: VisibleTag;
  onDelete: (id: string) => void;
  onUpdateColor: (id: string, color: string) => void;
}) {
  const [isColorPickerOpen, setIsColorPickerOpen] = React.useState(false);

  return (
    <div className="flex items-center justify-between group rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
          <PopoverTrigger
            className={cn(
              "h-4 w-4 rounded-full cursor-pointer hover:scale-110 transition-transform ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              getTagDotClass(tag.color || "slate")
            )}
            title="Change color"
          />
          <PopoverContent className="w-[200px] p-2" align="start">
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onUpdateColor(tag.id, color);
                    setIsColorPickerOpen(false);
                  }}
                  className={cn(
                    "h-5 w-5 rounded-full cursor-pointer transition-transform hover:scale-110",
                    getTagDotClass(color),
                    tag.color === color ? "ring-2 ring-offset-1 ring-primary ring-offset-background scale-110" : ""
                  )}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-sm", getTagColorClasses(tag.color || "slate"))}>{tag.name}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onDelete(tag.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface ManageTagsDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function ManageTagsDialog({ children, open, onOpenChange, hideTrigger = false }: ManageTagsDialogProps) {
  const db = usePowerSync();
  const { data: tags } = useQuery("SELECT * FROM tags ORDER BY name ASC");
  
  const [newTagName, setNewTagName] = React.useState("");
  const [newTagColor, setNewTagColor] = React.useState(TAG_COLORS[0]);
  const [optimisticTagColors, setOptimisticTagColors] = React.useState<Map<string, string>>(new Map());

  React.useEffect(() => {
    setOptimisticTagColors((prev) => {
      let didChange = false;
      const next = new Map(prev);

      tags.forEach((tag) => {
        const optimisticColor = next.get(tag.id);
        if (!optimisticColor) return;
        if (optimisticColor !== (tag.color ?? "slate")) return;

        next.delete(tag.id);
        didChange = true;
      });

      return didChange ? next : prev;
    });
  }, [tags]);

  const visibleTags = React.useMemo(
    () => tags.map((tag) => ({
      ...tag,
      color: optimisticTagColors.get(tag.id) ?? tag.color ?? null,
    })),
    [optimisticTagColors, tags]
  );

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    const tagName = newTagName.trim();
    const color = newTagColor;

    setNewTagName("");
    setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);

    await createTag(tagName, color);
  };

  const handleDeleteTag = async (id: string) => {
    setOptimisticTagColors((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    await db.execute(`DELETE FROM tags WHERE id = ?`, [id]);
  };

  const handleUpdateTagColor = (id: string, color: string) => {
    setOptimisticTagColors((prev) => {
      const next = new Map(prev);
      next.set(id, color);
      return next;
    });

    debouncedExecute(
      `UPDATE tags SET color = ? WHERE id = ?`,
      [color, id],
      `tag-color:${id}`
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!hideTrigger && (children ? (
        <DialogTrigger className="w-full">
          {children}
        </DialogTrigger>
      ) : (
        <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap text-xs font-medium hover:bg-accent hover:text-indigo-600 dark:hover:text-indigo-400 h-8 rounded-full px-2.5 gap-1.5 transition-colors">
          <TagIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Tags</span>
        </DialogTrigger>
      ))}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-4">
          <form onSubmit={handleAddTag} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tagName">Create New Tag</Label>
              <div className="flex gap-2">
                <input
                  autoFocus
                  id="tagName"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name..."
                  maxLength={30}
                  className="h-8 w-full min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                />
                <Button type="submit" disabled={!newTagName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-1">
              {TAG_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewTagColor(color)}
                  className={cn(
                    "h-6 w-6 rounded-full cursor-pointer transition-transform hover:scale-110",
                    getTagDotClass(color),
                    newTagColor === color ? "ring-2 ring-offset-2 ring-primary ring-offset-background scale-110" : ""
                  )}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </form>

          <div className="border-t pt-4">
            <Label className="mb-3 block text-muted-foreground">Existing Tags</Label>
            <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">No tags created yet.</p>
              ) : (
                visibleTags.map((tag) => (
                  <TagRow
                    key={tag.id}
                    tag={tag}
                    onDelete={handleDeleteTag}
                    onUpdateColor={handleUpdateTagColor}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
