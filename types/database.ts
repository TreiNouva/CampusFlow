// Tipe-tipe ini merefleksikan skema di supabase/migrations/0001_init.sql.
// Untuk proyek production sungguhan, generate otomatis lewat:
//   npx supabase gen types typescript --project-id <id> > types/database.ts

export type OrgRole = 'ketua' | 'wakil_ketua' | 'koordinator' | 'sekretaris' | 'bendahara' | 'member';
export type ProjectRole =
  | 'ketua'
  | 'project_manager'
  | 'wakil_project_manager'
  | 'pic'
  | 'koordinator'
  | 'bendahara'
  | 'sekretaris'
  | 'member';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type AttendanceStatus = 'present' | 'excused' | 'absent';
export type BudgetEntryType = 'income' | 'expense';
export type DocumentCategory = 'proposal' | 'lpj' | 'rundown' | 'notulen' | 'desain' | 'surat' | 'lainnya';
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
  | 'announcement_updated'
  | 'member_added'
  | 'member_removed'
  | 'member_role_changed'
  | 'document_uploaded'
  | 'event_created';

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
  division_id: string | null;
  created_at: string;
  profile?: Profile;
  division?: ProjectDivision | null;
}

export interface ProjectDivision {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Announcement {
  id: string;
  project_id: string;
  author_id: string;
  title: string;
  body: string;
  division_id: string | null;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, 'id' | 'full_name'> | null;
  division?: Pick<ProjectDivision, 'id' | 'name' | 'color'> | null;
}

export interface Invite {
  id: string;
  token: string;
  organization_id: string;
  project_id: string | null;
  division_id: string | null;
  created_by: string;
  expires_at: string;
  max_uses: number | null;
  uses_count: number;
  revoked_at: string | null;
  created_at: string;
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
  start_date: string | null;
  completed_at: string | null;
  division_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  division?: Pick<ProjectDivision, 'id' | 'name' | 'color'> | null;
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
  recipient?: { full_name: string } | null;
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

export interface ProjectEvent {
  id: string;
  project_id: string;
  division_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  created_by: string;
  created_at: string;
}

export interface EventAttendance {
  event_id: string;
  user_id: string;
  status: AttendanceStatus;
  checked_in_at: string | null;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  due_date: string;
  created_by: string;
}

export interface BudgetPlan {
  id: string;
  project_id: string;
  division_id: string | null;
  category: string;
  planned_amount: number;
}

export interface BudgetEntry {
  id: string;
  project_id: string;
  division_id: string | null;
  entry_type: BudgetEntryType;
  category: string;
  amount: number;
  note: string | null;
  entry_date: string;
  created_by: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  project_id: string;
  task_id: string | null;
  division_id: string | null;
  category: DocumentCategory;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
  uploader?: Pick<Profile, 'id' | 'full_name'> | null;
}
