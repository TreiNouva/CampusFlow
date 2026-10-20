-- ============================================================
-- CampusFlow — Migration 0003
--   * Ketua boleh menjadi Project Manager
--   * Member hanya bisa mengerjakan task divisinya sendiri
--   * Pengumuman / jadwal / dokumen bisa Global atau per divisi
--   * Warna per divisi, kalender project (acara, milestone, kehadiran)
--   * Status task "Review", tanggal mulai task, lampiran dokumen (Storage), budget
--
-- CARA PAKAI: Supabase > SQL Editor > New query, tempel SELURUH file ini, klik Run.
-- Jalankan SETELAH 0001 dan 0002, dan JANGAN dijalankan dua kali.
-- Jalankan SEBELUM men-deploy kode versi 6.
-- ============================================================

begin;

-- 1. Nilai enum baru ---------------------------------------------------------
alter type task_status add value if not exists 'review';
alter type activity_action add value if not exists 'document_uploaded';
alter type activity_action add value if not exists 'event_created';

create type attendance_status as enum ('present', 'excused', 'absent');
create type budget_entry_type as enum ('income', 'expense');
create type document_category as enum ('proposal', 'lpj', 'rundown', 'notulen', 'desain', 'surat', 'lainnya');

-- 2. Kolom baru ----------------------------------------------------------------
alter table project_divisions add column color text not null default 'blue';
-- warna awal berbeda untuk divisi yang sudah ada
with ranked as (
  select id, row_number() over (partition by project_id order by created_at, id) - 1 as rn from project_divisions
)
update project_divisions d
set color = (array['blue','orange','green','purple','pink','teal','yellow','red','indigo','gray'])[(ranked.rn % 10) + 1]
from ranked where ranked.id = d.id;

alter table tasks add column division_id uuid references project_divisions (id) on delete set null;
alter table tasks add column start_date date;
alter table tasks add column completed_at timestamptz;
create index idx_tasks_division on tasks (division_id);

-- task lama: ikut divisi PIC-nya
update tasks t set division_id = pm.division_id
from project_members pm
where pm.project_id = t.project_id and pm.user_id = t.assignee_id and pm.division_id is not null;
update tasks set completed_at = updated_at where status = 'done';

alter table announcements add column division_id uuid references project_divisions (id) on delete cascade;
create index idx_announcements_division on announcements (division_id);

create function public.set_task_completed_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger trg_tasks_completed_at before insert or update of status on tasks
  for each row execute procedure public.set_task_completed_at();

-- 3. Tabel baru ---------------------------------------------------------------
create table project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  division_id uuid references project_divisions (id) on delete cascade,   -- null = Global
  title text not null check (char_length(btrim(title)) between 2 and 150),
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  check (end_at >= start_at)
);
create index idx_events_project on project_events (project_id, start_at);

create table event_attendance (
  event_id uuid not null references project_events (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status attendance_status not null,
  checked_in_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  due_date date not null,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);
create index idx_milestones_project on project_milestones (project_id, due_date);

create table budget_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  division_id uuid references project_divisions (id) on delete set null,
  category text not null check (char_length(btrim(category)) between 2 and 60),
  planned_amount numeric(14,0) not null check (planned_amount >= 0),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);
create unique index uq_budget_plan on budget_plans
  (project_id, coalesce(division_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(category)));

create table budget_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  division_id uuid references project_divisions (id) on delete set null,
  entry_type budget_entry_type not null,
  category text not null check (char_length(btrim(category)) between 2 and 60),
  amount numeric(14,0) not null check (amount > 0),
  note text,
  entry_date date not null default current_date,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);
create index idx_budget_entries_project on budget_entries (project_id, entry_date desc);

create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  task_id uuid references tasks (id) on delete cascade,
  division_id uuid references project_divisions (id) on delete set null,   -- null = Global
  category document_category not null default 'lainnya',
  name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);
create index idx_documents_project on documents (project_id, created_at desc);
create index idx_documents_task on documents (task_id);

alter table project_events enable row level security;
alter table event_attendance enable row level security;
alter table project_milestones enable row level security;
alter table budget_plans enable row level security;
alter table budget_entries enable row level security;
alter table documents enable row level security;

-- 4. Fungsi bantu hak akses ---------------------------------------------------
create function public.project_division_of(p_project uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select division_id from project_members where project_id = p_project and user_id = auth.uid();
$$;

create function public.is_plain_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'member' from project_members where project_id = p_project and user_id = auth.uid()), false);
$$;

-- Melihat task: selain Member boleh semua; Member hanya task divisinya atau yang ditugaskan padanya
create function public.can_view_task(p_project uuid, p_div uuid, p_assignee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members pm
    where pm.project_id = p_project and pm.user_id = auth.uid()
      and (pm.role <> 'member'
           or p_assignee = auth.uid()
           or (p_div is not null and p_div = pm.division_id))
  );
$$;

create function public.can_view_task_id(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_view_task(t.project_id, t.division_id, t.assignee_id) from tasks t where t.id = p_task), false);
$$;

-- Membuat task: semua anggota kecuali Ketua (viewer); Member hanya untuk divisinya
create function public.can_create_task(p_project uuid, p_div uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members pm
    where pm.project_id = p_project and pm.user_id = auth.uid() and pm.role <> 'ketua'
      and (pm.role <> 'member' or (p_div is not null and p_div = pm.division_id))
  );
$$;

-- Mengubah task: sama, tetapi Member boleh juga task yang ditugaskan padanya
create function public.can_write_task(p_project uuid, p_div uuid, p_assignee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members pm
    where pm.project_id = p_project and pm.user_id = auth.uid() and pm.role <> 'ketua'
      and (pm.role <> 'member' or p_assignee = auth.uid() or (p_div is not null and p_div = pm.division_id))
  );
$$;

-- Item bercakupan (pengumuman, jadwal, dokumen): Global (div null) atau per divisi.
-- Ketua, PM, Wakil PM, dan Sekretaris melihat semuanya; peran lain: Global + divisinya sendiri.
create function public.can_view_scoped(p_project uuid, p_div uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members pm
    where pm.project_id = p_project and pm.user_id = auth.uid()
      and (pm.role in ('ketua', 'project_manager', 'wakil_project_manager', 'sekretaris')
           or p_div is null
           or p_div = pm.division_id)
  );
$$;

-- Mengelola item bercakupan: PM/Wakil PM/Sekretaris untuk semua; PIC & Koordinator hanya divisinya sendiri
create function public.can_manage_scoped(p_project uuid, p_div uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members pm
    where pm.project_id = p_project and pm.user_id = auth.uid()
      and (pm.role in ('project_manager', 'wakil_project_manager', 'sekretaris')
           or (pm.role in ('pic', 'koordinator') and p_div is not null and p_div = pm.division_id))
  );
$$;

create function public.can_view_budget(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members where project_id = p_project and user_id = auth.uid()
                 and role in ('ketua', 'project_manager', 'wakil_project_manager', 'bendahara'));
$$;

create function public.can_manage_budget(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members where project_id = p_project and user_id = auth.uid()
                 and role in ('project_manager', 'wakil_project_manager', 'bendahara'));
$$;

create function public.can_view_event_id(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_view_scoped(e.project_id, e.division_id) from project_events e where e.id = p_event), false);
$$;

-- Unggah dokumen: anggota (bukan Ketua viewer). Dokumen task: harus bisa mengubah task itu. Member hanya ke divisinya.
create function public.can_add_document(p_project uuid, p_task uuid, p_div uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_role project_role; v_mydiv uuid; v_t tasks;
begin
  select role, division_id into v_role, v_mydiv from project_members where project_id = p_project and user_id = auth.uid();
  if v_role is null or v_role = 'ketua' then return false; end if;
  if p_task is not null then
    select * into v_t from tasks where id = p_task and project_id = p_project;
    if not found then return false; end if;
    return public.can_write_task(p_project, v_t.division_id, v_t.assignee_id);
  end if;
  if v_role = 'member' then return p_div is not null and p_div = v_mydiv; end if;
  return true;
end $$;

create function public.can_view_document(p_project uuid, p_task uuid, p_div uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_task is not null then public.can_view_task_id(p_task)
              else public.can_view_scoped(p_project, p_div) end;
$$;

-- 5. Trigger konsistensi ------------------------------------------------------
-- Member yang ditugaskan harus satu divisi dengan task
create function public.check_task_member_scope() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role project_role; v_div uuid;
begin
  if new.division_id is not null and not exists (
    select 1 from project_divisions where id = new.division_id and project_id = new.project_id) then
    raise exception 'Divisi tidak ditemukan di project ini';
  end if;
  if new.assignee_id is not null then
    select role, division_id into v_role, v_div from project_members
      where project_id = new.project_id and user_id = new.assignee_id;
    if v_role = 'member' and new.division_id is distinct from v_div then
      raise exception 'Member hanya dapat mengerjakan task untuk divisinya sendiri';
    end if;
  end if;
  return new;
end $$;
create trigger trg_tasks_member_scope before insert or update of assignee_id, division_id on tasks
  for each row execute procedure public.check_task_member_scope();

-- 6. RPC ---------------------------------------------------------------------
-- Project baru: Ketua organisasi BOLEH menjadi Project Manager
create or replace function public.create_project(
  p_org uuid, p_name text, p_description text default null,
  p_start date default null, p_end date default null, p_pm uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_pm uuid; v_id uuid;
begin
  if v_uid is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if not public.is_org_member(p_org) then raise exception 'Kamu bukan anggota organisasi ini'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 3 then raise exception 'Nama project minimal 3 karakter'; end if;

  v_pm := coalesce(p_pm, v_uid);
  if not exists (select 1 from organization_members where organization_id = p_org and user_id = v_pm) then
    raise exception 'Project Manager harus anggota organisasi ini';
  end if;

  insert into projects (organization_id, name, description, start_date, end_date, created_by)
  values (p_org, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_start, p_end, v_uid)
  returning id into v_id;   -- trigger menambahkan Ketua sebagai viewer

  insert into project_members (project_id, user_id, role, notification_level)
  values (v_id, v_pm, 'project_manager', 'all')
  on conflict (project_id, user_id) do update set role = 'project_manager', notification_level = 'all';

  insert into activity_logs (project_id, actor_id, action_type, new_value)
  values (v_id, v_uid, 'project_created', btrim(p_name));
  return v_id;
end $$;

create or replace function public.set_project_member(
  p_project uuid, p_user uuid, p_role project_role, p_division uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.project_org(p_project);
  v_my project_role := public.project_role_of(p_project);
  v_org_mgr boolean := coalesce(public.is_org_manager(public.project_org(p_project)), false);
  v_is_pm boolean := coalesce(v_my = 'project_manager', false);
  v_is_mgr boolean := coalesce(v_my in ('project_manager', 'wakil_project_manager'), false);
  v_cur project_role;
  v_div uuid := p_division;
  v_target_ketua boolean;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if v_org is null then raise exception 'Project tidak ditemukan'; end if;
  if not (v_org_mgr or v_is_mgr) then
    raise exception 'Hanya Project Manager, Wakil Project Manager, atau Ketua/Wakil Ketua organisasi yang dapat mengatur anggota project';
  end if;
  if not exists (select 1 from organization_members where organization_id = v_org and user_id = p_user) then
    raise exception 'User belum menjadi anggota organisasi. Undang ke organisasi terlebih dahulu';
  end if;
  v_target_ketua := exists (select 1 from organization_members where organization_id = v_org and user_id = p_user and role = 'ketua');
  if p_role = 'ketua' and not v_target_ketua then raise exception 'Peran Ketua diatur otomatis untuk Ketua organisasi'; end if;
  if v_target_ketua and p_role not in ('ketua', 'project_manager') then
    raise exception 'Ketua organisasi hanya dapat menjadi viewer (Ketua) atau Project Manager di project ini';
  end if;

  select role into v_cur from project_members where project_id = p_project and user_id = p_user;

  if p_role in ('project_manager', 'wakil_project_manager') and not (v_org_mgr or v_is_pm) then
    raise exception 'Hanya Project Manager (atau Ketua/Wakil Ketua organisasi) yang dapat menunjuk Project Manager atau Wakil Project Manager';
  end if;
  if v_cur = 'project_manager' and p_role <> 'project_manager' then
    raise exception 'Project Manager tidak bisa diturunkan langsung. Tunjuk Project Manager baru agar peran ini otomatis berpindah';
  end if;
  if v_cur = 'wakil_project_manager' and p_role <> 'wakil_project_manager'
     and not (v_org_mgr or v_is_pm or p_user = auth.uid()) then
    raise exception 'Hanya Project Manager yang dapat mengubah Wakil Project Manager';
  end if;

  if v_div is not null then
    if p_role not in ('pic', 'koordinator', 'member') then
      v_div := null;
    elsif not exists (select 1 from project_divisions where id = v_div and project_id = p_project) then
      raise exception 'Divisi tidak ditemukan di project ini';
    end if;
  end if;

  -- Peran tunggal: pemegang lama kembali menjadi Ketua (viewer) bila ia Ketua organisasi, selain itu Member
  if p_role in ('project_manager', 'wakil_project_manager') then
    update project_members pm
    set role = (case when exists (select 1 from organization_members om
                                  where om.organization_id = v_org and om.user_id = pm.user_id and om.role = 'ketua')
                     then 'ketua' else 'member' end)::project_role,
        division_id = null
    where pm.project_id = p_project and pm.role = p_role and pm.user_id <> p_user;
  end if;

  insert into project_members (project_id, user_id, role, division_id, notification_level)
  values (p_project, p_user, p_role, v_div, 'important')
  on conflict (project_id, user_id) do update set role = excluded.role, division_id = excluded.division_id;

  insert into activity_logs (project_id, actor_id, action_type, new_value, metadata)
  values (p_project, auth.uid(),
          case when v_cur is null then 'member_added' else 'member_role_changed' end::activity_action,
          (select full_name from profiles where id = p_user),
          jsonb_build_object('role', p_role, 'user_id', p_user));
end $$;

-- Kehadiran: dicatat oleh yang berhak mengelola jadwal tsb
create function public.set_attendance(p_event uuid, p_user uuid, p_status attendance_status) returns void
language plpgsql security definer set search_path = public as $$
declare v_e project_events;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  select * into v_e from project_events where id = p_event;
  if not found then raise exception 'Acara tidak ditemukan'; end if;
  if not public.can_manage_scoped(v_e.project_id, v_e.division_id) then
    raise exception 'Kamu tidak berhak mencatat kehadiran untuk acara ini';
  end if;
  if not exists (select 1 from project_members pm where pm.project_id = v_e.project_id and pm.user_id = p_user
                 and pm.role <> 'ketua'
                 and (v_e.division_id is null or pm.division_id = v_e.division_id
                      or pm.role in ('project_manager', 'wakil_project_manager', 'sekretaris'))) then
    raise exception 'User bukan peserta acara ini';
  end if;
  insert into event_attendance (event_id, user_id, status, checked_in_at)
  values (p_event, p_user, p_status, case when p_status = 'present' then now() end)
  on conflict (event_id, user_id) do update
    set status = excluded.status, updated_at = now(),
        checked_in_at = case when excluded.status = 'present' then coalesce(event_attendance.checked_in_at, now()) else null end;
end $$;

-- Check-in mandiri: 2 jam sebelum sampai 12 jam setelah acara dimulai
create function public.check_in_event(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_e project_events;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  select * into v_e from project_events where id = p_event;
  if not found then raise exception 'Acara tidak ditemukan'; end if;
  if not public.can_view_scoped(v_e.project_id, v_e.division_id) then raise exception 'Acara tidak ditemukan'; end if;
  if public.project_role_of(v_e.project_id) = 'ketua' then raise exception 'Ketua (viewer) tidak perlu check-in'; end if;
  if now() < v_e.start_at - interval '2 hours' then raise exception 'Check-in baru dibuka 2 jam sebelum acara dimulai'; end if;
  if now() > v_e.start_at + interval '12 hours' then raise exception 'Waktu check-in acara ini sudah lewat'; end if;
  insert into event_attendance (event_id, user_id, status, checked_in_at)
  values (p_event, auth.uid(), 'present', now())
  on conflict (event_id, user_id) do update set status = 'present', checked_in_at = coalesce(event_attendance.checked_in_at, now()), updated_at = now();
end $$;

-- 7. RLS (tabel yang diubah: tugas, komentar, aktivitas, pengumuman; tabel baru) -------
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
           and tablename in ('tasks', 'comments', 'activity_logs', 'announcements', 'project_divisions') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy divisions_select on project_divisions for select to authenticated using (public.is_project_member(project_id));
create policy divisions_insert on project_divisions for insert to authenticated with check (public.is_project_manager(project_id));
create policy divisions_update on project_divisions for update to authenticated
  using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));
create policy divisions_delete on project_divisions for delete to authenticated using (public.is_project_manager(project_id));

create policy tasks_select on tasks for select to authenticated
  using (public.can_view_task(project_id, division_id, assignee_id));
create policy tasks_insert on tasks for insert to authenticated
  with check (created_by = auth.uid() and public.can_create_task(project_id, division_id));
create policy tasks_update on tasks for update to authenticated
  using (public.can_write_task(project_id, division_id, assignee_id))
  with check (public.can_write_task(project_id, division_id, assignee_id));

create policy comments_select on comments for select to authenticated using (public.can_view_task_id(task_id));
create policy comments_insert on comments for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from tasks t where t.id = task_id and public.can_write_task(t.project_id, t.division_id, t.assignee_id)));

create policy activity_select on activity_logs for select to authenticated
  using (public.is_project_member(project_id)
         and (task_id is null and action_type not in ('project_announcement', 'announcement_updated')
              or task_id is not null and public.can_view_task_id(task_id)));

create policy announcements_select on announcements for select to authenticated
  using (author_id = auth.uid() or public.can_view_scoped(project_id, division_id));
create policy announcements_insert on announcements for insert to authenticated
  with check (author_id = auth.uid() and public.can_manage_scoped(project_id, division_id)
              or author_id = auth.uid() and division_id is null and public.can_post_announcement(project_id));
create policy announcements_update on announcements for update to authenticated
  using (author_id = auth.uid() or public.is_project_manager(project_id))
  with check (author_id = auth.uid() or public.is_project_manager(project_id));
create policy announcements_delete on announcements for delete to authenticated
  using (author_id = auth.uid() or public.is_project_manager(project_id));

create policy events_select on project_events for select to authenticated using (public.can_view_scoped(project_id, division_id));
create policy events_insert on project_events for insert to authenticated
  with check (created_by = auth.uid() and public.can_manage_scoped(project_id, division_id));
create policy events_update on project_events for update to authenticated
  using (public.can_manage_scoped(project_id, division_id)) with check (public.can_manage_scoped(project_id, division_id));
create policy events_delete on project_events for delete to authenticated using (public.can_manage_scoped(project_id, division_id));

create policy attendance_select on event_attendance for select to authenticated using (public.can_view_event_id(event_id));

create policy milestones_select on project_milestones for select to authenticated using (public.is_project_member(project_id));
create policy milestones_insert on project_milestones for insert to authenticated
  with check (created_by = auth.uid() and public.is_project_manager(project_id));
create policy milestones_update on project_milestones for update to authenticated
  using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));
create policy milestones_delete on project_milestones for delete to authenticated using (public.is_project_manager(project_id));

create policy budget_plans_select on budget_plans for select to authenticated using (public.can_view_budget(project_id));
create policy budget_plans_insert on budget_plans for insert to authenticated
  with check (created_by = auth.uid() and public.can_manage_budget(project_id));
create policy budget_plans_update on budget_plans for update to authenticated
  using (public.can_manage_budget(project_id)) with check (public.can_manage_budget(project_id));
create policy budget_plans_delete on budget_plans for delete to authenticated using (public.can_manage_budget(project_id));

create policy budget_entries_select on budget_entries for select to authenticated using (public.can_view_budget(project_id));
create policy budget_entries_insert on budget_entries for insert to authenticated
  with check (created_by = auth.uid() and public.can_manage_budget(project_id));
create policy budget_entries_update on budget_entries for update to authenticated
  using (public.can_manage_budget(project_id)) with check (public.can_manage_budget(project_id));
create policy budget_entries_delete on budget_entries for delete to authenticated using (public.can_manage_budget(project_id));

create policy documents_select on documents for select to authenticated
  using (public.can_view_document(project_id, task_id, division_id));
create policy documents_insert on documents for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_add_document(project_id, task_id, division_id));
create policy documents_delete on documents for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_project_manager(project_id));

-- 8. Pembatasan kolom & hak eksekusi -------------------------------------------
revoke update on announcements from authenticated;
grant update (title, body, division_id, updated_at) on announcements to authenticated;
revoke update on project_divisions from authenticated;
grant update (name, color) on project_divisions to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'project_division_of(uuid)', 'is_plain_member(uuid)', 'can_view_task(uuid,uuid,uuid)', 'can_view_task_id(uuid)',
    'can_create_task(uuid,uuid)', 'can_write_task(uuid,uuid,uuid)', 'can_view_scoped(uuid,uuid)',
    'can_manage_scoped(uuid,uuid)', 'can_view_budget(uuid)', 'can_manage_budget(uuid)', 'can_view_event_id(uuid)',
    'can_add_document(uuid,uuid,uuid)', 'can_view_document(uuid,uuid,uuid)',
    'create_project(uuid,text,text,date,date,uuid)', 'set_project_member(uuid,uuid,project_role,uuid)',
    'set_attendance(uuid,uuid,attendance_status)', 'check_in_event(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

commit;
