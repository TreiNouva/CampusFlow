-- ============================================================
-- CampusFlow — Initial schema
-- Sesuai dokumen "CampusFlow Web Prototype Specification" §9
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- ENUM types
-- ------------------------------------------------------------
create type org_role as enum ('admin', 'coordinator', 'member', 'viewer');
create type project_role as enum ('coordinator', 'member', 'viewer');
create type task_status as enum ('todo', 'in_progress', 'done', 'blocked');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type notification_level as enum ('all', 'important', 'off');
create type activity_action as enum (
  'task_created', 'task_status_changed', 'task_assignee_changed',
  'task_due_date_changed', 'task_priority_changed', 'task_commented',
  'project_created', 'project_announcement', 'member_added'
);
create type notification_status as enum ('pending', 'sent', 'failed');

-- ------------------------------------------------------------
-- profiles: 1-1 dengan auth.users, dibuat otomatis via trigger
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- organizations & members
-- ------------------------------------------------------------
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table organization_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ------------------------------------------------------------
-- projects & project members
-- ------------------------------------------------------------
create table projects (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active', -- active | completed | archived
  start_date date,
  end_date date,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table project_members (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role project_role not null default 'member',
  notification_level notification_level not null default 'important',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- ------------------------------------------------------------
-- tasks
-- ------------------------------------------------------------
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references profiles (id),
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  due_date date,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references profiles (id),
  content text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- activity log — histori seluruh perubahan penting
-- ------------------------------------------------------------
create table activity_logs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects (id) on delete cascade,
  task_id uuid references tasks (id) on delete cascade,
  actor_id uuid not null references profiles (id),
  action_type activity_action not null,
  old_value text,
  new_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- notifications (in-app, opsional untuk prototype)
-- ------------------------------------------------------------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  project_id uuid references projects (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- notification_logs — status pengiriman EMAIL (bukan in-app)
-- ------------------------------------------------------------
create table notification_logs (
  id uuid primary key default uuid_generate_v4(),
  event_type activity_action not null,
  recipient_id uuid not null references profiles (id),
  project_id uuid not null references projects (id) on delete cascade,
  task_id uuid references tasks (id) on delete cascade,
  status notification_status not null default 'pending',
  provider_id text,
  error_message text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index idx_org_members_org on organization_members (organization_id);
create index idx_org_members_user on organization_members (user_id);
create index idx_projects_org on projects (organization_id);
create index idx_project_members_project on project_members (project_id);
create index idx_project_members_user on project_members (user_id);
create index idx_tasks_project on tasks (project_id);
create index idx_tasks_assignee on tasks (assignee_id);
create index idx_activity_project on activity_logs (project_id);
create index idx_activity_task on activity_logs (task_id);
create index idx_notification_logs_project on notification_logs (project_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Prinsip (§14): user hanya melihat organisasi/project yang
-- diikuti; server (bukan hanya frontend) yang menegakkan ini.
-- ============================================================

alter table profiles enable row level security;
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table activity_logs enable row level security;
alter table notifications enable row level security;
alter table notification_logs enable row level security;

-- Helper: apakah user adalah anggota organisasi tsb.
create function public.is_org_member(org_id uuid)
returns boolean as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Helper: apakah user adalah admin organisasi tsb.
create function public.is_org_admin(org_id uuid)
returns boolean as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Helper: apakah user adalah anggota project tsb (langsung atau lewat org admin).
create function public.is_project_member(p_id uuid)
returns boolean as $$
  select exists (
    select 1 from project_members pm
    where pm.project_id = p_id and pm.user_id = auth.uid()
  ) or exists (
    select 1 from projects p
    join organization_members om on om.organization_id = p.organization_id
    where p.id = p_id and om.user_id = auth.uid() and om.role = 'admin'
  );
$$ language sql security definer stable;

-- profiles: semua user login boleh melihat profil dasar (nama/email) — dibutuhkan untuk menampilkan PIC, dsb.
create policy "profiles_select_authenticated" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- organizations
create policy "organizations_select_member" on organizations
  for select using (public.is_org_member(id));
create policy "organizations_insert_self" on organizations
  for insert with check (created_by = auth.uid());
create policy "organizations_update_admin" on organizations
  for update using (public.is_org_admin(id));

-- organization_members
create policy "org_members_select_same_org" on organization_members
  for select using (public.is_org_member(organization_id));
create policy "org_members_insert_admin" on organization_members
  for insert with check (
    public.is_org_admin(organization_id) or
    -- pembuat organisasi otomatis jadi admin pertama
    not exists (select 1 from organization_members where organization_id = organization_members.organization_id)
  );
create policy "org_members_update_admin" on organization_members
  for update using (public.is_org_admin(organization_id));
create policy "org_members_delete_admin" on organization_members
  for delete using (public.is_org_admin(organization_id));

-- projects
create policy "projects_select_org_member" on projects
  for select using (public.is_org_member(organization_id));
create policy "projects_insert_org_member" on projects
  for insert with check (public.is_org_member(organization_id) and created_by = auth.uid());
create policy "projects_update_coordinator_or_admin" on projects
  for update using (
    public.is_org_admin(organization_id) or public.is_project_member(id)
  );

-- project_members
create policy "project_members_select" on project_members
  for select using (public.is_project_member(project_id));
create policy "project_members_insert" on project_members
  for insert with check (public.is_project_member(project_id));
create policy "project_members_update" on project_members
  for update using (public.is_project_member(project_id));

-- tasks — member hanya boleh mengubah task di dalam project-nya (§14)
create policy "tasks_select_project_member" on tasks
  for select using (public.is_project_member(project_id));
create policy "tasks_insert_project_member" on tasks
  for insert with check (public.is_project_member(project_id));
create policy "tasks_update_project_member" on tasks
  for update using (public.is_project_member(project_id));

-- comments
create policy "comments_select_project_member" on comments
  for select using (
    exists (select 1 from tasks t where t.id = task_id and public.is_project_member(t.project_id))
  );
create policy "comments_insert_project_member" on comments
  for insert with check (
    exists (select 1 from tasks t where t.id = task_id and public.is_project_member(t.project_id))
  );

-- activity_logs — read-only dari sisi client, hanya server (service role) yang insert
create policy "activity_select_project_member" on activity_logs
  for select using (public.is_project_member(project_id));

-- notifications (in-app)
create policy "notifications_select_own" on notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on notifications
  for update using (user_id = auth.uid());

-- notification_logs — hanya untuk audit, dibaca oleh anggota project (debug email §13 getNotificationLogs)
create policy "notification_logs_select_project_member" on notification_logs
  for select using (public.is_project_member(project_id));

-- ============================================================
-- Trigger: updated_at pada tasks
-- ============================================================
create function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute procedure public.set_updated_at();
