import * as React from "react";
import { usePowerSync, useQuery } from "@powersync/react";
import { v4 as uuidv4 } from "uuid";
import { Plus, Trash2, Tag as TagIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag } from "@/lib/powersync/AppSchema";
import { cn } from "@/lib/utils";
import { TAG_COLORS, getTagColorClasses, getTagDotClass } from "@/lib/colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCurrentUserId } from "@/lib/tasks";

export function ManageTagsDialog({ children }: { children?: React.ReactNode }) {
  const db = usePowerSync();
  const { data: tags } = useQuery("SELECT * FROM tags ORDER BY name ASC");
  
  const [newTagName, setNewTagName] = React.useState("");
  const [newTagColor, setNewTagColor] = React.useState(TAG_COLORS[0]);

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    const newId = uuidv4();
    const userId = await getCurrentUserId();

    await db.execute(
      `INSERT INTO tags (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [newId, userId, newTagName.trim(), newTagColor]
    );
    
    setNewTagName("");
    setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
  };

  const handleDeleteTag = async (id: string) => {
    await db.execute(`DELETE FROM tags WHERE id = ?`, [id]);
  };

  const handleUpdateTagColor = async (id: string, color: string) => {
    await db.execute(`UPDATE tags SET color = ?, updated_at = datetime('now') WHERE id = ?`, [color, id]);
  };

  return (
    <Dialog>
      <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-2 sm:px-3 text-xs gap-2">
        <TagIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Manage Tags</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-4">
          <form onSubmit={handleAddTag} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tagName">Create New Tag</Label>
              <div className="flex gap-2">
                <Input 
                  id="tagName" 
                  value={newTagName} 
                  onChange={(e) => setNewTagName(e.target.value)} 
                  placeholder="Tag name..." 
                  maxLength={30}
                  className="flex-1"
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
                tags.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between group rounded-md border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger className={cn("h-4 w-4 rounded-full cursor-pointer hover:scale-110 transition-transform ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", getTagDotClass(tag.color || 'slate'))} title="Change color" />
                        <PopoverContent className="w-[200px] p-2" align="start">
                          <div className="flex flex-wrap gap-2">
                            {TAG_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => handleUpdateTagColor(tag.id, color)}
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
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-sm", getTagColorClasses(tag.color || 'slate'))}>{tag.name}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteTag(tag.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
