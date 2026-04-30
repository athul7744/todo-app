import * as React from "react";
import { Task, Tag } from "@/lib/powersync/AppSchema";
import { usePowerSync, useQuery } from "@powersync/react";
import { Check, CheckCircle2, Trash2, Calendar as CalendarIcon, Plus, CornerDownRight, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";
import { getTagColorClasses, TAG_COLORS, getTagDotClass } from "@/lib/colors";
import { getCurrentUserId, PRIORITY_COLORS, PRIORITY_LEVELS, getDueDateInfo, autoResizeTextarea } from "@/lib/tasks";

interface TaskCardProps {
  task: Task;
  subtasks: Task[];
  isNew?: boolean;
  onNewCancel?: () => void;
}

export function TaskCard({ task, subtasks, isNew, onNewCancel }: TaskCardProps) {
  const db = usePowerSync();
  const [title, setTitle] = React.useState(task.title || "");
  const [priority, setPriority] = React.useState(task.priority || "medium");
  
  const [dueDate, setDueDate] = React.useState<Date | undefined>(
    task.due_date ? new Date(task.due_date) : undefined
  );
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
  
  // Tags Logic
  const { data: allTags } = useQuery("SELECT * FROM tags ORDER BY name ASC");
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>(() => {
    try { return JSON.parse(task.tags || "[]"); } catch { return []; }
  });
  const [isTagSelectorOpen, setIsTagSelectorOpen] = React.useState(false);
  const [tagSearchQuery, setTagSearchQuery] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  
  // Optimistic UI state
  const [optimisticSubtasks, setOptimisticSubtasks] = React.useState<Task[]>([]);
  const [optimisticState, setOptimisticState] = React.useState(task.state);
  const [optimisticSubtaskStates, setOptimisticSubtaskStates] = React.useState<Record<string, string>>({});
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => { setOptimisticState(task.state); }, [task.state]);

  // Sync optimistic subtasks with real data
  React.useEffect(() => {
    if (optimisticSubtasks.length > 0 && subtasks.length > 0) {
      setOptimisticSubtasks(prev => {
        const filtered = prev.filter(opt => !subtasks.some(st => st.id === opt.id));
        return filtered.length !== prev.length ? filtered : prev;
      });
    }
  }, [subtasks, optimisticSubtasks.length]);

  const combinedSubtasks = [
    ...subtasks,
    ...optimisticSubtasks.filter(opt => !subtasks.some(st => st.id === opt.id))
  ];

  // --- Task Actions ---

  const handleUpdate = async (field: string, value: string | null) => {
    if (isNew) return;
    await db.execute(`UPDATE tasks SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`, [value, task.id]);
  };

  const handleSaveNew = async () => {
    if (!title.trim()) { onNewCancel?.(); return; }
    setIsSaving(true);
    const userId = await getCurrentUserId();
    await db.execute(
      `INSERT INTO tasks (id, user_id, title, priority, state, due_date, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))`,
      [task.id, userId, title.trim(), priority, dueDate ? dueDate.toISOString() : null, JSON.stringify(selectedTagIds)]
    );
  };

  const handleAddSubtask = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
      const newSubtaskId = uuidv4();
      const subtaskTitle = newSubtaskTitle.trim();
      const userId = await getCurrentUserId();
      
      setNewSubtaskTitle("");
      setOptimisticSubtasks(prev => [...prev, {
        id: newSubtaskId, parent_id: task.id, title: subtaskTitle,
        priority: 'low', state: 'pending', tags: "[]",
      } as Task]);

      await db.execute(
        `INSERT INTO tasks (id, user_id, parent_id, title, priority, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'low', 'pending', datetime('now'), datetime('now'))`,
        [newSubtaskId, userId, task.id, subtaskTitle]
      );
    }
  };

  const toggleTaskState = async (t: Task) => {
    const newState = t.state === 'completed' ? 'pending' : 'completed';
    
    if (!t.parent_id) {
      setOptimisticState(newState);
      if (newState === 'completed') {
        const updates: Record<string, string> = {};
        subtasks.forEach(st => updates[st.id] = 'completed');
        setOptimisticSubtaskStates(prev => ({ ...prev, ...updates }));
      }
    } else {
      setOptimisticSubtaskStates(prev => ({ ...prev, [t.id]: newState }));
    }

    await db.execute(`UPDATE tasks SET state = ?, updated_at = datetime('now') WHERE id = ?`, [newState, t.id]);
    if (newState === 'completed' && !t.parent_id) {
      await db.execute(`UPDATE tasks SET state = 'completed', updated_at = datetime('now') WHERE parent_id = ?`, [t.id]);
    }
  };

  const trashTask = async (t: Task) => {
    // For the parent task, use optimisticState; for subtasks, use their own state
    const currentState = t.id === task.id ? optimisticState : (optimisticSubtaskStates[t.id] || t.state);
    if (currentState === 'trashed') {
      // Permanently delete — animate out
      setIsDeleting(true);
      setTimeout(async () => {
        await db.execute(`DELETE FROM tasks WHERE id = ?`, [t.id]);
        if (!t.parent_id) await db.execute(`DELETE FROM tasks WHERE parent_id = ?`, [t.id]);
      }, 150);
    } else {
      // Move to trash — no animation, card stays visible if trashed filter is active
      await db.execute(`UPDATE tasks SET state = 'trashed', updated_at = datetime('now') WHERE id = ?`, [t.id]);
      if (!t.parent_id) await db.execute(`UPDATE tasks SET state = 'trashed', updated_at = datetime('now') WHERE parent_id = ?`, [t.id]);
    }
  };

  const restoreTask = async () => {
    await db.execute(`UPDATE tasks SET state = 'pending', updated_at = datetime('now') WHERE id = ?`, [task.id]);
    if (!task.parent_id) {
      await db.execute(`UPDATE tasks SET state = 'pending', updated_at = datetime('now') WHERE parent_id = ?`, [task.id]);
    }
  };

  const handleCreateInlineTag = async () => {
    const newId = uuidv4();
    const userId = await getCurrentUserId();
    const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    
    await db.execute(
      `INSERT INTO tags (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [newId, userId, tagSearchQuery.trim(), randomColor]
    );
    
    const newTags = [...selectedTagIds, newId];
    setSelectedTagIds(newTags);
    if (!isNew) await handleUpdate("tags", JSON.stringify(newTags));
    setTagSearchQuery("");
  };

  const handleToggleTag = async (tagId: string) => {
    const isSelected = selectedTagIds.includes(tagId);
    const newTags = isSelected
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId];
    setSelectedTagIds(newTags);
    if (!isNew) await handleUpdate("tags", JSON.stringify(newTags));
  };

  // --- Derived UI State ---

  const dueDateInfo = getDueDateInfo(dueDate);
  const isTrashed = optimisticState === 'trashed';

  return (
    <div className={cn(
      "group relative flex flex-col rounded-xl border shadow-sm transition-all duration-300 hover:shadow-md mb-4 overflow-hidden break-inside-avoid",
      optimisticState === 'trashed'
        ? "bg-rose-50/40 dark:bg-rose-950/15 border-rose-200/40 dark:border-rose-800/30"
        : "bg-card border-border",
      optimisticState === 'completed' ? "opacity-60 bg-muted/50" : "",
      isDeleting ? "opacity-0 scale-95" : "opacity-100 scale-100"
    )}>
      {/* Main Task Header */}
      <div className="flex items-start gap-3 p-4">
        {!isNew && !isTrashed && (
          <button
            onClick={() => toggleTaskState(task)}
            className={cn(
              "h-5 w-5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors mt-0.5",
              optimisticState === 'completed' 
                ? "bg-emerald-500 border-emerald-500 text-white" 
                : "border-muted-foreground/30 hover:border-emerald-500/50"
            )}
          >
            {optimisticState === 'completed' && <Check className="h-3.5 w-3.5 stroke-[3]" />}
          </button>
        )}
        
        <div className="flex flex-col flex-1 gap-2 min-w-0">
          {/* Title */}
          <textarea
            ref={autoResizeTextarea}
            maxLength={250}
            rows={1}
            className={`bg-transparent text-[15px] font-semibold focus:outline-none placeholder:text-muted-foreground/50 w-full resize-none overflow-hidden block min-h-[24px] ${task.state === 'completed' || isTrashed ? 'line-through text-muted-foreground' : 'text-card-foreground'}`}
            placeholder="Task Title..."
            value={title}
            readOnly={isTrashed}
            onChange={(e) => { if (!isTrashed) { autoResizeTextarea(e.target); setTitle(e.target.value); } }}
            onBlur={() => { if (!isNew && !isTrashed) handleUpdate("title", title); }}
            onKeyDown={(e) => {
              if (isTrashed) return;
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isNew) handleSaveNew(); else e.currentTarget.blur();
              }
            }}
            autoFocus={isNew}
          />
          
          {/* Metadata Row — hidden for trashed tasks */}
          {!isTrashed && (
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 pb-0.5">
            {/* Due Date Picker */}
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger
                className={cn(
                  "flex items-center h-6 px-1.5 justify-start text-left font-normal text-xs hover:bg-accent hover:text-accent-foreground rounded-md transition-colors -ml-1.5 shrink-0 whitespace-nowrap",
                  !dueDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    setDueDate(date);
                    if (!isNew) handleUpdate("due_date", date ? date.toISOString() : null);
                    setIsCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Due Date Pill */}
            {dueDateInfo.show && (
              <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm ${dueDateInfo.bg} ${dueDateInfo.text} whitespace-nowrap shrink-0`}>
                {dueDateInfo.label}
              </span>
            )}

            {/* Tag Selector */}
            <Popover open={isTagSelectorOpen} onOpenChange={setIsTagSelectorOpen}>
              <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-6 px-1.5 text-xs text-muted-foreground shrink-0 rounded-md">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tag
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
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
                            <div className={cn("h-3 w-3 rounded-full mr-2", getTagDotClass(tag.color || 'slate'))} />
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
          )}

          {/* Selected Tags */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {selectedTagIds.map(tagId => {
                const tag = allTags.find((t: Tag) => t.id === tagId);
                if (!tag) return null;
                return (
                  <Badge key={tag.id} variant="secondary" className={cn("px-1.5 py-0 h-5 text-[10px] font-medium gap-1 rounded-sm shadow-none", getTagColorClasses(tag.color || 'slate'))}>
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions: Priority + Restore + Trash */}
        <div className="flex items-center gap-1 ml-auto pl-1 h-6">
          {!isTrashed && (
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none rounded-full ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <div 
                  className={cn(
                    "h-3 w-3 rounded-full shadow-sm ring-2 ring-offset-1 ring-offset-background transition-colors",
                    PRIORITY_COLORS[priority]?.bg || PRIORITY_COLORS.medium.bg,
                    PRIORITY_COLORS[priority]?.ring || PRIORITY_COLORS.medium.ring
                  )} 
                  title={`Priority: ${priority}`}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                {PRIORITY_LEVELS.map((p) => (
                  <DropdownMenuItem 
                    key={p} 
                    onClick={() => { setPriority(p); if (!isNew) handleUpdate("priority", p); }}
                    className="flex items-center gap-2 cursor-pointer capitalize"
                  >
                    <div className={cn("h-2.5 w-2.5 rounded-full", PRIORITY_COLORS[p].bg)} />
                    {p}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isTrashed && !isNew && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-emerald-600 -mt-1 shrink-0 transition-colors" onClick={restoreTask} title="Restore task">
              <Undo2 className="h-4 w-4" />
            </Button>
          )}

          {!isNew && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-destructive -mt-1 -mr-1 shrink-0 transition-colors" onClick={() => trashTask(task)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Subtasks Section */}
      {!isNew && (
        <div className="bg-muted/20 border-t border-border p-3 pl-4 flex flex-col gap-1.5">
          {combinedSubtasks.map((st: any) => {
            const currentState = optimisticSubtaskStates[st.id] || st.state;
            return (
              <div key={st.id} className={cn("flex items-center gap-2 group/subtask", currentState === 'completed' ? "opacity-60" : "")}>
                <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 ml-1 mt-0.5" />
                {!isTrashed && (
                  <button 
                    onClick={() => toggleTaskState(st)}
                    className={cn(
                      "h-4 w-4 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors mt-0.5",
                      currentState === 'completed' 
                        ? "bg-emerald-500 border-emerald-500 text-white" 
                        : "border-muted-foreground/30 hover:border-emerald-500/50"
                    )}
                  >
                    {currentState === 'completed' && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </button>
                )}
                
                <textarea
                  ref={autoResizeTextarea}
                  maxLength={250}
                  rows={1}
                  className={`bg-transparent text-[13px] focus:outline-none flex-1 resize-none overflow-hidden block min-h-[20px] pt-0.5 ${currentState === 'completed' || isTrashed ? 'line-through text-muted-foreground' : 'text-card-foreground'}`}
                  defaultValue={st.title || ""}
                  readOnly={isTrashed}
                  onChange={(e) => { if (!isTrashed) autoResizeTextarea(e.target); }}
                  onBlur={(e) => { if (!isTrashed) db.execute(`UPDATE tasks SET title = ?, updated_at = datetime('now') WHERE id = ?`, [e.target.value, st.id]); }}
                  onKeyDown={(e) => {
                    if (isTrashed) return;
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
                  }}
                />
                
                {!isTrashed && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all shrink-0" onClick={() => trashTask(st)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          
          {/* Add Subtask — hidden for trashed */}
          {!isTrashed && (
            <div className="flex items-start gap-3 mt-1 p-1">
              <Plus className="h-3.5 w-3.5 text-primary ml-1.5 shrink-0 mt-0.5" />
              <textarea
                maxLength={250}
                rows={1}
                placeholder="Add subtask... (press Enter)"
                className="bg-transparent text-[13px] focus:outline-none flex-1 text-muted-foreground placeholder:text-muted-foreground/50 resize-none overflow-hidden block min-h-[20px]"
                value={newSubtaskTitle}
                onChange={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  setNewSubtaskTitle(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddSubtask(e as any);
                    e.currentTarget.style.height = 'auto';
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Save/Cancel for Drafts */}
      {isNew && (
        <div className="bg-muted/10 border-t border-border p-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onNewCancel} disabled={isSaving}>Cancel</Button>
          <Button size="sm" onClick={handleSaveNew} disabled={!title.trim() || isSaving}>
            {isSaving ? "Saving..." : "Save Task"}
          </Button>
        </div>
      )}
    </div>
  );
}
