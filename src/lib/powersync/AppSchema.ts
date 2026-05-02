import { column, Schema, Table } from '@powersync/web';

export const tasksTable = new Table({
  user_id: column.text,
  parent_id: column.text,
  title: column.text,
  due_date: column.text,
  tags: column.text, // stored as JSON array string
  priority: column.text,
  state: column.text,
  created_at: column.text,
  updated_at: column.text
});

export const tagsTable = new Table({
  user_id: column.text,
  name: column.text,
  color: column.text,
  created_at: column.text
});

export const timeLogsTable = new Table({
  user_id: column.text,
  activity_name: column.text,
  start_timestamp: column.text,
  duration_minutes: column.integer,
  created_at: column.text
});

export const activityTypesTable = new Table({
  user_id: column.text,
  name: column.text,
  color: column.text,
  created_at: column.text
});

export const AppSchema = new Schema({
  tasks: tasksTable,
  tags: tagsTable,
  time_logs: timeLogsTable,
  activity_types: activityTypesTable
});

export type Database = (typeof AppSchema)['types'];
export type Task = Database['tasks'];
export type Tag = Database['tags'];
export type TimeLog = Database['time_logs'];
export type ActivityType = Database['activity_types'];
