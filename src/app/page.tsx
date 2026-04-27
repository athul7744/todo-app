"use client";

import { usePowerSync, useQuery } from '@powersync/react';
import { Plus, ListTodo, CheckCircle2, Moon, Sun, Filter, Tag as TagIcon, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Task, Tag } from '@/lib/powersync/AppSchema';
import { TaskCard } from '@/components/TaskCard';
import { ManageTagsDialog } from '@/components/ManageTagsDialog';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export default function Home() {
  const db = usePowerSync();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [filterState, setFilterState] = useState<'all' | 'pending' | 'completed' | 'trashed'>('pending');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);

  const [newTasks, setNewTasks] = useState<Task[]>([]);

  // Fetch Tags for the Filter
  const { data: allTags } = useQuery("SELECT * FROM tags ORDER BY name ASC");

  // Dynamic Query Builder
  let query = `SELECT * FROM tasks WHERE 1=1`;
  const args: any[] = [];

  if (filterState === 'all') {
    query += ` AND state != 'trashed'`;
  } else {
    query += ` AND state = ?`;
    args.push(filterState);
  }

  if (filterPriority !== 'all') {
    query += ` AND priority = ?`;
    args.push(filterPriority);
  }

  filterTags.forEach(tagId => {
    query += ` AND tags LIKE ?`;
    args.push(`%"${tagId}"%`);
  });

  query += ` ORDER BY CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END, due_date ASC, created_at DESC`;
  
  const { data: allTasks } = useQuery(query, args);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    // If we add a task while viewing 'completed' or 'trashed', switch back to 'pending' to see it
    if (filterState === 'completed' || filterState === 'trashed') {
      setFilterState('pending');
    }
  };

  const handleCancelNewTask = (id: string) => {
    setNewTasks(prev => prev.filter(t => t.id !== id));
  };

  // Grouping Logic
  const topLevelTasks = allTasks.filter(t => !t.parent_id);
  const getSubtasks = (parentId: string) => allTasks.filter(t => t.parent_id === parentId);

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
            <h1 className="text-2xl font-bold tracking-tight hidden sm:block">Tasks</h1>
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
          </div>
        </div>

        {/* Sleek Filter Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-2">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">Filters:</span>
          </div>

          <Select value={filterState} onValueChange={(val: any) => setFilterState(val)}>
            <SelectTrigger className="w-[120px] h-8 text-xs font-medium">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="trashed">Trashed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={(val) => setFilterPriority(val as string)}>
            <SelectTrigger className="w-[120px] h-8 text-xs font-medium">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>

          {/* Tags Filter */}
          <Popover open={isTagFilterOpen} onOpenChange={setIsTagFilterOpen}>
            <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs border-dashed gap-2">
              <TagIcon className="h-3.5 w-3.5" />
              {filterTags.length > 0 ? `${filterTags.length} Tags` : "Tags"}
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search tags..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No tags found.</CommandEmpty>
                  <CommandGroup>
                    {allTags.map((tag) => {
                      const isSelected = filterTags.includes(tag.id);
                      return (
                        <CommandItem
                          key={tag.id}
                          onSelect={() => {
                            if (isSelected) {
                              setFilterTags(filterTags.filter(id => id !== tag.id));
                            } else {
                              setFilterTags([...filterTags, tag.id]);
                            }
                          }}
                        >
                          <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                            <CheckCircle2 className="h-3 w-3" />
                          </div>
                          <div className={cn("h-3 w-3 rounded-full mr-2", tag.color)} />
                          <span>{tag.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Active Tags Display */}
          {filterTags.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2">
              {filterTags.map(tagId => {
                const tag = allTags.find(t => t.id === tagId);
                if (!tag) return null;
                return (
                  <Badge key={tag.id} variant="secondary" className="px-2 py-0 h-6 text-[11px] gap-1 bg-secondary hover:bg-secondary/80 pr-1">
                    <div className={cn("h-2 w-2 rounded-full", tag.color)} />
                    {tag.name}
                    <div 
                      className="ml-1 hover:bg-muted p-0.5 rounded-full cursor-pointer" 
                      onClick={() => setFilterTags(filterTags.filter(id => id !== tag.id))}
                    >
                      <X className="h-3 w-3" />
                    </div>
                  </Badge>
                );
              })}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setFilterTags([])}
              >
                Clear
              </Button>
            </div>
          )}
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
            <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6 px-1 pb-4">
              {/* Render Draft New Tasks */}
              {newTasks.map((newTask) => (
                <TaskCard 
                  key={newTask.id} 
                  task={newTask} 
                  subtasks={[]} 
                  isNew={true} 
                  onNewCancel={() => handleCancelNewTask(newTask.id)} 
                />
              ))}

              {/* Render Existing Tasks */}
              {topLevelTasks.map((task: any) => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  subtasks={getSubtasks(task.id)} 
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
