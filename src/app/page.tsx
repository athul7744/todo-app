"use client";

import { usePowerSync, useQuery } from '@powersync/react';
import { Plus, ListTodo, CheckCircle2, Moon, Sun, Filter, Tag as TagIcon, X, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Task, Tag } from '@/lib/powersync/AppSchema';
import { TaskCard } from '@/components/TaskCard';
import { ManageTagsDialog } from '@/components/ManageTagsDialog';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { getTagColorClasses, getTagDotClass } from '@/lib/colors';
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { SyncIndicator } from "@/components/SyncIndicator";

export default function Home() {
  const db = usePowerSync();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };
  
  const [filterStates, setFilterStates] = useState<string[]>(['pending']);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [newTasks, setNewTasks] = useState<Task[]>([]);

  // Fetch Tags for the Filter
  const { data: allTags } = useQuery("SELECT * FROM tags ORDER BY name ASC");

  // Dynamic Query Builder
  let query = `SELECT * FROM tasks WHERE state != 'trashed'`;
  const args: any[] = [];
  const parentConditions: string[] = [];

  if (filterStates.length > 0) {
    const placeholders = filterStates.map(() => '?').join(',');
    parentConditions.push(`state IN (${placeholders})`);
    args.push(...filterStates);
  }

  if (filterPriorities.length > 0) {
    const placeholders = filterPriorities.map(() => '?').join(',');
    parentConditions.push(`priority IN (${placeholders})`);
    args.push(...filterPriorities);
  }

  filterTags.forEach(tagId => {
    parentConditions.push(`tags LIKE ?`);
    args.push(`%"${tagId}"%`);
  });

  if (parentConditions.length > 0) {
    query += ` AND (parent_id IS NOT NULL OR (${parentConditions.join(' AND ')}))`;
  }

  query += ` ORDER BY CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END, due_date ASC, created_at DESC`;
  
  const { data: allTasks } = useQuery(query, args);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterStates, filterPriorities, filterTags]);

  // Sync draft tasks: once a task appears in the DB subscription (allTasks), remove it from the draft list
  // This prevents layout jumps because we don't manually remove it until the DB query catches up.
  useEffect(() => {
    if (newTasks.length > 0 && allTasks.length > 0) {
      setNewTasks(prev => {
        const filtered = prev.filter(nt => !allTasks.some(t => t.id === nt.id));
        return filtered.length !== prev.length ? filtered : prev;
      });
    }
  }, [allTasks, newTasks.length]);

  const handleAddNewTask = () => {
    const tempTask = {
      id: uuidv4(),
      title: "",
      priority: "medium",
      state: "pending",
      due_date: "",
      tags: "[]",
    } as Task;
    setNewTasks(prev => [tempTask, ...prev]);
    setPage(1); // Jump to page 1 so the new task is visible when saved
    // If we add a task while viewing 'completed' or 'trashed' and NOT 'pending', ensure 'pending' is selected
    if (!filterStates.includes('pending')) {
      setFilterStates(prev => [...prev, 'pending']);
    }
  };

  const handleCancelNewTask = (id: string) => {
    setNewTasks(prev => prev.filter(t => t.id !== id));
  };

  // Grouping Logic
  const topLevelTasks = allTasks.filter(t => !t.parent_id);
  const getSubtasks = (parentId: string) => allTasks.filter(t => t.parent_id === parentId);

  // Pagination Logic
  const totalPages = Math.ceil(topLevelTasks.length / itemsPerPage);
  const paginatedTopLevelTasks = topLevelTasks.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden min-w-0">
      
      {/* Top Navigation & Filter Row */}
      <header className="sticky top-0 z-20 flex flex-col gap-4 border-b border-border bg-background/95 backdrop-blur-md px-4 md:px-8 py-4 shrink-0">
        
        {/* Title & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <ListTodo className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight hidden sm:block">Tasks<span className="text-primary">.</span></h1>
            <div className="ml-2 hidden sm:flex">
              <SyncIndicator />
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <ManageTagsDialog />
            
            <Button onClick={handleAddNewTask} className="gap-2 rounded-full shadow-sm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Task</span>
            </Button>
            
            {mounted && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-full ml-1"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              className="rounded-full text-muted-foreground hover:text-destructive"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Unified Filter Row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-1 px-1 -mx-1">
          <div className="flex items-center text-muted-foreground shrink-0 mr-1">
            <Filter className="h-4 w-4" />
          </div>

          {/* Unified sorted pills */}
          {(() => {
            const pills: any[] = [];

            // State pills
            (['pending', 'completed', 'trashed'] as const).forEach(state => {
              const isActive = filterStates.includes(state);
              
              let activeClass = "bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700";
              if (state === 'completed') activeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700";
              if (state === 'trashed') activeClass = "bg-rose-100 text-rose-700 dark:bg-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-700";

              pills.push({
                id: `state-${state}`,
                type: 'state',
                label: state,
                isActive,
                activeClass,
                onClick: () => {
                  if (isActive) {
                    setFilterStates(filterStates.filter(s => s !== state));
                  } else {
                    setFilterStates([...filterStates, state]);
                  }
                }
              });
            });

            // Priority pills
            (['low', 'medium', 'high', 'urgent'] as const).forEach(p => {
              const isActive = filterPriorities.includes(p);
              
              let activeClass = "bg-sky-100 text-sky-700 dark:bg-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-700";
              if (p === 'medium') activeClass = "bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700";
              if (p === 'high') activeClass = "bg-orange-100 text-orange-700 dark:bg-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-700";
              if (p === 'urgent') activeClass = "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200 border border-red-200 dark:border-red-700";
              
              pills.push({
                id: `priority-${p}`,
                type: 'priority',
                label: p,
                isActive,
                activeClass,
                onClick: () => {
                  if (isActive) {
                    setFilterPriorities(filterPriorities.filter(pr => pr !== p));
                  } else {
                    setFilterPriorities([...filterPriorities, p]);
                  }
                }
              });
            });

            // Tag pills
            filterTags.forEach(tagId => {
              const tag = allTags.find((t: Tag) => t.id === tagId);
              if (tag) {
                pills.push({
                  id: `tag-${tag.id}`,
                  type: 'tag',
                  label: tag.name,
                  isActive: true,
                  activeClass: getTagColorClasses(tag.color || 'slate'),
                  onClick: () => setFilterTags(filterTags.filter(id => id !== tag.id))
                });
              }
            });

            // Sort so active pills are always at the front
            pills.sort((a, b) => {
              if (a.isActive && !b.isActive) return -1;
              if (!a.isActive && b.isActive) return 1;
              return 0;
            });

            return pills.map(pill => (
              <button
                key={pill.id}
                onClick={pill.onClick}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-full transition-all capitalize shrink-0 flex items-center gap-1.5",
                  pill.isActive 
                    ? pill.activeClass
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent"
                )}
              >
                {pill.label}
                {pill.type === 'tag' && (
                  <X className="h-3.5 w-3.5 ml-0.5 opacity-70" />
                )}
              </button>
            ));
          })()}

          {/* Tags Add Button */}
          <Popover open={isTagFilterOpen} onOpenChange={setIsTagFilterOpen}>
            <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-accent h-[32px] rounded-full px-4 text-sm gap-2 transition-colors shrink-0 ml-1 border border-transparent">
              <TagIcon className="h-3.5 w-3.5" />
              {filterTags.length > 0 ? `${filterTags.length}/3 Tags` : "Tags"}
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search tags..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No tags found.</CommandEmpty>
                  <CommandGroup>
                    {allTags.map((tag) => {
                      const isSelected = filterTags.includes(tag.id);
                      const isMaxReached = filterTags.length >= 3 && !isSelected;
                      
                      return (
                        <CommandItem
                          key={tag.id}
                          disabled={isMaxReached}
                          className={isMaxReached ? "opacity-50 cursor-not-allowed" : ""}
                          onSelect={() => {
                            if (isSelected) {
                              setFilterTags(filterTags.filter(id => id !== tag.id));
                            } else if (!isMaxReached) {
                              setFilterTags([...filterTags, tag.id]);
                            }
                          }}
                        >
                          <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                            <CheckCircle2 className="h-3 w-3" />
                          </div>
                          <div className={cn("h-2.5 w-2.5 rounded-full mr-2", getTagDotClass(tag.color || 'slate'))} />
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
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          
          {/* Task List */}
          {topLevelTasks.length === 0 && newTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-20 text-center border-2 border-dashed border-border rounded-xl bg-card/50 mx-2">
              <div className="bg-primary/10 p-5 rounded-full mb-5">
                <ListTodo className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No tasks found</h3>
              <p className="text-muted-foreground max-w-sm mb-8 text-base px-4">
                No tasks match your current filters. Try adjusting them or add a new task!
              </p>
              <Button onClick={handleAddNewTask} className="gap-2 rounded-full h-11 px-6">
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6 px-1 pb-4">
                {/* Render Combined Tasks to Prevent Layout Jumps */}
                {(() => {
                  const combinedTasks = [
                    ...newTasks.filter(nt => !paginatedTopLevelTasks.some((t: any) => t.id === nt.id)),
                    ...paginatedTopLevelTasks
                  ];

                  return combinedTasks.map((task: any) => {
                    const isDraft = newTasks.some(nt => nt.id === task.id);
                    return (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        subtasks={isDraft ? [] : getSubtasks(task.id)} 
                        isNew={isDraft} 
                        onNewCancel={() => handleCancelNewTask(task.id)} 
                      />
                    );
                  });
                })()}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8 pb-12">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-full h-9 w-9"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="text-sm font-medium text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-full h-9 w-9"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
