// Tipe-tipe ini merefleksikan skema di supabase/migrations/0001_init.sql.
// Untuk proyek production sungguhan, generate otomatis lewat:
//   npx supabase gen types typescript --project-id <id> > types/database.ts

export type OrgRole = 'admin' | 'coordinator' | 'member' | 'viewer';
export type ProjectRole = 'coordinator' | 'member' | 'viewer';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationLevel = 'all' | 'important' | 'off';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export type ActivityAction =
  | 'task_created'
  | 'task_status_changed'
  | 'task_assignee_changed'
  | 'task_due_date_changed'
  | 'task_priority_changed'
  | 'task_commented'
  | 'project_created'
  | 'project_announcement'
  | 'member_added';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  profile?: Profile;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'completed' | 'archived';
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  notification_level: NotificationLevel;
  created_at: string;
  profile?: Profile;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface ActivityLog {
  id: string;
  project_id: string;
  task_id: string | null;
  actor_id: string;
  action_type: ActivityAction;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: Profile;
  task?: Pick<Task, 'id' | 'title'>;
}

export interface NotificationLog {
  id: string;
  event_type: ActivityAction;
  recipient_id: string;
  project_id: string;
  task_id: string | null;
  status: NotificationStatus;
  provider_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  project_id: string | null;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

/** Helper gabungan untuk halaman dashboard proyek. */
export interface ProjectWithProgress extends Project {
  task_count: number;
  done_count: number;
  member_count: number;
}
