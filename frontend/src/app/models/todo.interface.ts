export type TodoStatus = 'todo' | 'bezig' | 'klaar';
export type TodoPriority = 'laag' | 'normaal' | 'dringend' | 'urgent';

export interface TodoAssignee {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface Todo {
  id: string;
  kotgroup_id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees: TodoAssignee[];
}
