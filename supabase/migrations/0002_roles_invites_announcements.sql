-- ============================================================
-- CampusFlow — Migration 0002
--   * Role organisasi baru  : Ketua, Wakil Ketua, Koordinator, Sekretaris, Bendahara, Member
--   * Role project baru     : Ketua (viewer), Project Manager, Wakil PM, PIC, Koordinator,
--                             Bendahara, Sekretaris, Member
--   * Divisi project, link undangan (invite), pengumuman (bisa dilihat & diedit)
--   * Semua aturan hak akses (RLS) ditulis ulang
--
-- CARA PAKAI: buka Supabase > SQL Editor > New query, tempel SELURUH isi file ini, klik Run.
-- Aman dijalankan pada database yang sudah berisi data (data lama dikonversi otomatis).
-- Seluruh skrip berjalan dalam satu transaksi: kalau ada error, tidak ada yang berubah.
-- Jangan dijalankan dua kali.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Bersihkan semua RLS policy & fungsi lama (dibuat ulang di bawah)
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

drop function if exists public.is_org_member(uuid);
drop function if exists public.is_org_admin(uuid);
drop function if exists public.is_project_member(uuid);
drop function if exists public.organization_has_members(uuid);
drop function if exists public.project_has_members(uuid);
drop function if exists public.is_project_org_member(uuid);

-- ------------------------------------------------------------
-- 1. Jenis aktivitas baru (untuk activity feed)
-- ------------------------------------------------------------
alter type activity_action add value if not exists 'member_removed';
alter type activity_action add value if not exists 'member_role_changed';
alter type activity_action add value if not exists 'announcement_updated';

-- ------------------------------------------------------------
-- 2. Role ORGANISASI baru (data lama dikonversi)
--    admin pertama (pembuat org) -> ketua | admin lain & coordinator -> koordinator | sisanya -> member
-- ------------------------------------------------------------
alter type org_role rename to org_role_old;
create type org_role as enum ('ketua', 'wakil_ketua', 'koordinator', 'sekretaris', 'bendahara', 'member');

alter table organization_members add column role_new org_role;

with ranked as (
  select om.id,
         om.role::text as r,
         row_number() over (
           partition by om.organization_id, (om.role::text = 'admin')
           order by (om.user_id = o.created_by) desc, om.created_at, om.id
         ) as rn
  from organization_members om
  join organizations o on o.id = om.organization_id
)
update organization_members om
set role_new = (case
    when ranked.r = 'admin' and ranked.rn = 1 then 'ketua'
    when ranked.r in ('admin', 'coordinator') then 'koordinator'
    else 'member'
  end)::org_role
from ranked
where ranked.id = om.id;

-- Organisasi yang (karena data aneh) belum punya Ketua: angkat pembuat / anggota tertua
update organization_members om
set role_new = 'ketua'
where om.id in (
  select distinct on (x.organization_id) x.id
  from organization_members x
  join organizations o on o.id = x.organization_id
  where not exists (
    select 1 from organization_members k
    where k.organization_id = x.organization_id and k.role_new = 'ketua'
  )
  order by x.organization_id, (x.user_id = o.created_by) desc, x.created_at, x.id
);

alter table organization_members drop column role;
alter table organization_members rename column role_new to role;
alter table organization_members alter column role set not null;
alter table organization_members alter column role set default 'member';
drop type org_role_old;

create unique index uq_org_one_ketua on organization_members (organization_id) where role = 'ketua';
create unique index uq_org_one_wakil on organization_members (organization_id) where role = 'wakil_ketua';

-- ------------------------------------------------------------
-- 3. Role PROJECT baru (data lama dikonversi)
--    coordinator pertama (pembuat project) -> project_manager | coordinator lain -> koordinator
--    member & viewer -> member
-- ------------------------------------------------------------
alter type project_role rename to project_role_old;
create type project_role as enum (
  'ketua', 'project_manager', 'wakil_project_manager', 'pic',
  'koordinator', 'bendahara', 'sekretaris', 'member'
);

alter table project_members add column role_new project_role;

with ranked as (
  select pm.id,
         pm.role::text as r,
         row_number() over (
           partition by pm.project_id, (pm.role::text = 'coordinator')
           order by (pm.user_id = p.created_by) desc, pm.created_at, pm.id
         ) as rn
  from project_members pm
  join projects p on p.id = pm.project_id
)
update project_members pm
set role_new = (case
    when ranked.r = 'coordinator' and ranked.rn = 1 then 'project_manager'
    when ranked.r = 'coordinator' then 'koordinator'
    else 'member'
  end)::project_role
from ranked
where ranked.id = pm.id;

-- Project yang belum punya Project Manager: angkat pembuat / anggota tertua
update project_members pm
set role_new = 'project_manager'
where pm.id in (
  select distinct on (x.project_id) x.id
  from project_members x
  join projects p on p.id = x.project_id
  where not exists (
    select 1 from project_members k
    where k.project_id = x.project_id and k.role_new = 'project_manager'
  )
  order by x.project_id, (x.user_id = p.created_by) desc, x.created_at, x.id
);

alter table project_members drop column role;
alter table project_members rename column role_new to role;
alter table project_members alter column role set not null;
alter table project_members alter column role set default 'member';
drop type project_role_old;

create unique index uq_project_one_pm on project_members (project_id) where role = 'project_manager';
create unique index uq_project_one_wakil_pm on project_members (project_id) where role = 'wakil_project_manager';
create unique index uq_project_one_ketua on project_members (project_id) where role = 'ketua';

-- ------------------------------------------------------------
-- 4. Tabel baru: divisi, undangan, pengumuman
-- ------------------------------------------------------------
create table project_divisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index uq_division_name on project_divisions (project_id, lower(btrim(name)));
create index idx_divisions_project on project_divisions (project_id);

alter table project_members add column division_id uuid references project_divisions (id) on delete set null;
-- Divisi hanya untuk PIC, Koordinator, dan Member
alter table project_members add constraint chk_division_role
  check (division_id is null or role in ('pic', 'koordinator', 'member'));

create table invites (
  id uuid primary key default gen_random_uuid(),
  -- token acak panjang (2 x UUID v4 = 244 bit acak), dipakai sebagai bagian dari link
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  organization_id uuid not null references organizations (id) on delete cascade,
  project_id uuid references projects (id) on delete cascade,   -- null = undangan organisasi
  division_id uuid references project_divisions (id) on delete set null,
  created_by uuid not null references profiles (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_invites_org on invites (organization_id);
create index idx_invites_project on invites (project_id);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  author_id uuid not null references profiles (id),
  title text not null check (char_length(btrim(title)) between 3 and 150),
  body text not null check (char_length(btrim(body)) >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_announcements_project on announcements (project_id, created_at desc);

create trigger announcements_set_updated_at
  before update on announcements
  for each row execute procedure public.set_updated_at();

alter table project_divisions enable row level security;
alter table invites enable row level security;
alter table announcements enable row level security;

-- ------------------------------------------------------------
-- 5. Fungsi bantu hak akses (dipakai oleh RLS & fungsi RPC)
-- ------------------------------------------------------------
create function public.org_role_of(p_org uuid) returns org_role
language sql stable security definer set search_path = public as $$
  select role from organization_members where organization_id = p_org and user_id = auth.uid();
$$;

create function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members where organization_id = p_org and user_id = auth.uid());
$$;

-- Pengurus inti organisasi: Ketua & Wakil Ketua
create function public.is_org_manager(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org and user_id = auth.uid() and role in ('ketua', 'wakil_ketua')
  );
$$;

create function public.project_org(p_project uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from projects where id = p_project;
$$;

create function public.project_role_of(p_project uuid) returns project_role
language sql stable security definer set search_path = public as $$
  select role from project_members where project_id = p_project and user_id = auth.uid();
$$;

create function public.is_project_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members where project_id = p_project and user_id = auth.uid());
$$;

-- Boleh mengubah task: semua anggota project KECUALI Ketua (viewer)
create function public.is_project_writer(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members
    where project_id = p_project and user_id = auth.uid() and role <> 'ketua'
  );
$$;

-- Project Manager & Wakil Project Manager
create function public.is_project_manager(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members
    where project_id = p_project and user_id = auth.uid() and role in ('project_manager', 'wakil_project_manager')
  );
$$;

-- Boleh membuat pengumuman
create function public.can_post_announcement(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members
    where project_id = p_project and user_id = auth.uid()
      and role in ('project_manager', 'wakil_project_manager', 'pic', 'koordinator', 'sekretaris')
  );
$$;

-- ------------------------------------------------------------
-- 6. Trigger konsistensi data
-- ------------------------------------------------------------

-- Ketua otomatis menjadi anggota (viewer) di SEMUA project; keluar dari organisasi = keluar dari semua project
create function public.sync_org_member_projects() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from project_members
    where user_id = old.user_id
      and project_id in (select id from projects where organization_id = old.organization_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.role = 'ketua' and new.role <> 'ketua' then
    delete from project_members
    where user_id = old.user_id and role = 'ketua'
      and project_id in (select id from projects where organization_id = old.organization_id);
  end if;

  if new.role = 'ketua' and (tg_op = 'INSERT' or old.role <> 'ketua') then
    -- Jika Ketua baru sudah punya peran lain di sebuah project, peran itu diganti menjadi Ketua
    -- (kecuali ia Project Manager, agar project tidak kehilangan manager).
    insert into project_members (project_id, user_id, role, notification_level)
    select p.id, new.user_id, 'ketua', 'important'
    from projects p
    where p.organization_id = new.organization_id
    on conflict (project_id, user_id) do update
      set role = 'ketua', division_id = null
      where project_members.role <> 'project_manager';
  end if;
  return new;
end $$;

create trigger trg_org_members_sync_projects
  after insert or update of role or delete on organization_members
  for each row execute procedure public.sync_org_member_projects();

-- Project baru: Ketua organisasi otomatis ikut sebagai viewer
create function public.add_ketua_to_new_project() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into project_members (project_id, user_id, role, notification_level)
  select new.id, om.user_id, 'ketua', 'important'
  from organization_members om
  where om.organization_id = new.organization_id and om.role = 'ketua'
  on conflict (project_id, user_id) do nothing;
  return new;
end $$;

create trigger trg_projects_add_ketua
  after insert on projects
  for each row execute procedure public.add_ketua_to_new_project();

-- Anggota keluar/dikeluarkan dari project: task yang ditugaskan padanya jadi belum ditugaskan
create function public.unassign_tasks_of_removed_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update tasks set assignee_id = null
  where project_id = old.project_id and assignee_id = old.user_id;
  return old;
end $$;

create trigger trg_project_members_unassign
  after delete on project_members
  for each row execute procedure public.unassign_tasks_of_removed_member();

-- PIC task harus anggota project (bukan Ketua yang hanya viewer)
create function public.check_task_assignee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    if not exists (
      select 1 from project_members
      where project_id = new.project_id and user_id = new.assignee_id and role <> 'ketua'
    ) then
      raise exception 'PIC task harus anggota project (Ketua hanya berperan sebagai viewer)';
    end if;
  end if;
  return new;
end $$;

create trigger trg_tasks_check_assignee
  before insert or update of assignee_id on tasks
  for each row execute procedure public.check_task_assignee();

-- ------------------------------------------------------------
-- 7. Fungsi RPC (dipanggil dari aplikasi). Semua pemeriksaan hak akses ada DI SINI (server/database),
--    bukan di frontend.
-- ------------------------------------------------------------

create function public.create_organization(p_name text, p_description text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 3 then raise exception 'Nama organisasi minimal 3 karakter'; end if;

  insert into organizations (name, description, created_by)
  values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), v_uid)
  returning id into v_id;

  insert into organization_members (organization_id, user_id, role) values (v_id, v_uid, 'ketua');
  return v_id;
end $$;

-- Tambah anggota organisasi / ubah role. Ketua tidak bisa diubah di sini (pakai transfer_ketua).
create function public.set_org_member(p_org uuid, p_user uuid, p_role org_role) returns void
language plpgsql security definer set search_path = public as $$
declare v_my org_role := public.org_role_of(p_org); v_target org_role;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if v_my is null or v_my not in ('ketua', 'wakil_ketua') then
    raise exception 'Hanya Ketua atau Wakil Ketua yang dapat mengatur anggota organisasi';
  end if;
  if p_role = 'ketua' then
    raise exception 'Gunakan fitur "Alihkan jabatan Ketua" untuk mengganti Ketua';
  end if;

  select role into v_target from organization_members where organization_id = p_org and user_id = p_user;
  if v_target = 'ketua' then
    raise exception 'Jabatan Ketua tidak bisa diubah langsung. Alihkan jabatan Ketua ke anggota lain terlebih dahulu';
  end if;
  if p_role = 'wakil_ketua' and v_my <> 'ketua' then
    raise exception 'Hanya Ketua yang dapat menunjuk Wakil Ketua';
  end if;
  if v_target = 'wakil_ketua' and v_my <> 'ketua' and p_user <> auth.uid() then
    raise exception 'Hanya Ketua yang dapat mengubah jabatan Wakil Ketua';
  end if;

  -- Wakil Ketua hanya satu: pemegang lama otomatis menjadi Member
  if p_role = 'wakil_ketua' then
    update organization_members set role = 'member'
    where organization_id = p_org and role = 'wakil_ketua' and user_id <> p_user;
  end if;

  insert into organization_members (organization_id, user_id, role)
  values (p_org, p_user, p_role)
  on conflict (organization_id, user_id) do update set role = excluded.role;
end $$;

create function public.remove_org_member(p_org uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_my org_role := public.org_role_of(p_org); v_target org_role;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if v_my is null or v_my not in ('ketua', 'wakil_ketua') then
    raise exception 'Hanya Ketua atau Wakil Ketua yang dapat mengeluarkan anggota organisasi';
  end if;
  select role into v_target from organization_members where organization_id = p_org and user_id = p_user;
  if v_target is null then raise exception 'Anggota tidak ditemukan di organisasi ini'; end if;
  if v_target = 'ketua' then
    raise exception 'Ketua tidak dapat dikeluarkan. Alihkan jabatan Ketua terlebih dahulu';
  end if;
  if v_target = 'wakil_ketua' and v_my <> 'ketua' then
    raise exception 'Hanya Ketua yang dapat mengeluarkan Wakil Ketua';
  end if;

  delete from organization_members where organization_id = p_org and user_id = p_user;
  -- trigger: keanggotaan project user ini di organisasi tsb ikut terhapus & task-nya dilepas
end $$;

create function public.transfer_ketua(p_org uuid, p_new_ketua uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if public.org_role_of(p_org) is distinct from 'ketua' then
    raise exception 'Hanya Ketua yang dapat mengalihkan jabatan Ketua';
  end if;
  if p_new_ketua = auth.uid() then raise exception 'Pilih anggota lain sebagai Ketua baru'; end if;
  if not exists (select 1 from organization_members where organization_id = p_org and user_id = p_new_ketua) then
    raise exception 'Calon Ketua harus anggota organisasi ini';
  end if;

  update organization_members set role = 'member' where organization_id = p_org and user_id = auth.uid();
  update organization_members set role = 'ketua' where organization_id = p_org and user_id = p_new_ketua;
end $$;

-- Buat project. Pembuat menjadi Project Manager (atau menunjuk orang lain). Ketua otomatis ikut sebagai viewer.
create function public.create_project(
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
  if exists (select 1 from organization_members where organization_id = p_org and user_id = v_pm and role = 'ketua') then
    raise exception 'Ketua organisasi otomatis menjadi viewer di semua project dan tidak bisa menjadi Project Manager. Pilih anggota lain';
  end if;

  insert into projects (organization_id, name, description, start_date, end_date, created_by)
  values (p_org, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_start, p_end, v_uid)
  returning id into v_id;   -- trigger menambahkan Ketua sebagai viewer

  insert into project_members (project_id, user_id, role, notification_level)
  values (v_id, v_pm, 'project_manager', 'all');

  insert into activity_logs (project_id, actor_id, action_type, new_value)
  values (v_id, v_uid, 'project_created', btrim(p_name));

  return v_id;
end $$;

-- Anggota organisasi bergabung sendiri ke project yang ada di organisasinya
create function public.join_project(p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.project_org(p_project); v_rows integer;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if v_org is null then raise exception 'Project tidak ditemukan'; end if;
  if not public.is_org_member(v_org) then
    raise exception 'Hanya anggota organisasi yang dapat bergabung ke project ini';
  end if;

  insert into project_members (project_id, user_id, role, notification_level)
  values (p_project, auth.uid(), 'member', 'important')
  on conflict (project_id, user_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    insert into activity_logs (project_id, actor_id, action_type, new_value, metadata)
    values (p_project, auth.uid(), 'member_added',
            (select full_name from profiles where id = auth.uid()), jsonb_build_object('role', 'member', 'self_join', true));
  end if;
end $$;

-- Tambah anggota project / ubah role & divisi
create function public.set_project_member(
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
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if v_org is null then raise exception 'Project tidak ditemukan'; end if;
  if not (v_org_mgr or v_is_mgr) then
    raise exception 'Hanya Project Manager, Wakil Project Manager, atau Ketua/Wakil Ketua organisasi yang dapat mengatur anggota project';
  end if;
  if not exists (select 1 from organization_members where organization_id = v_org and user_id = p_user) then
    raise exception 'User belum menjadi anggota organisasi. Undang ke organisasi terlebih dahulu';
  end if;
  if p_role = 'ketua' then raise exception 'Peran Ketua diatur otomatis untuk Ketua organisasi'; end if;
  if exists (select 1 from organization_members where organization_id = v_org and user_id = p_user and role = 'ketua') then
    raise exception 'Ketua organisasi otomatis menjadi viewer di semua project dan perannya tidak dapat diubah';
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

  -- Divisi hanya berlaku untuk PIC, Koordinator, Member
  if v_div is not null then
    if p_role not in ('pic', 'koordinator', 'member') then
      v_div := null;
    elsif not exists (select 1 from project_divisions where id = v_div and project_id = p_project) then
      raise exception 'Divisi tidak ditemukan di project ini';
    end if;
  end if;

  -- Peran tunggal: pemegang lama otomatis menjadi Member
  if p_role = 'project_manager' then
    update project_members set role = 'member', division_id = null
    where project_id = p_project and role = 'project_manager' and user_id <> p_user;
  elsif p_role = 'wakil_project_manager' then
    update project_members set role = 'member', division_id = null
    where project_id = p_project and role = 'wakil_project_manager' and user_id <> p_user;
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

-- Keluarkan anggota dari project (Project Manager / Wakil PM / Ketua & Wakil Ketua organisasi)
create function public.remove_project_member(p_project uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.project_org(p_project);
  v_my project_role := public.project_role_of(p_project);
  v_org_mgr boolean := coalesce(public.is_org_manager(public.project_org(p_project)), false);
  v_is_pm boolean := coalesce(v_my = 'project_manager', false);
  v_is_mgr boolean := coalesce(v_my in ('project_manager', 'wakil_project_manager'), false);
  v_cur project_role;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if v_org is null then raise exception 'Project tidak ditemukan'; end if;
  if not (v_org_mgr or v_is_mgr) then
    raise exception 'Hanya Project Manager, Wakil Project Manager, atau Ketua/Wakil Ketua organisasi yang dapat mengeluarkan anggota project';
  end if;

  select role into v_cur from project_members where project_id = p_project and user_id = p_user;
  if v_cur is null then raise exception 'Anggota tidak ditemukan di project ini'; end if;
  if v_cur = 'ketua' then
    raise exception 'Ketua organisasi otomatis menjadi anggota semua project dan tidak dapat dikeluarkan';
  end if;
  if v_cur = 'project_manager' then
    raise exception 'Tunjuk Project Manager baru sebelum mengeluarkan Project Manager saat ini';
  end if;
  if v_cur = 'wakil_project_manager' and not (v_org_mgr or v_is_pm or p_user = auth.uid()) then
    raise exception 'Hanya Project Manager yang dapat mengeluarkan Wakil Project Manager';
  end if;

  delete from project_members where project_id = p_project and user_id = p_user;
  -- trigger: task yang ditugaskan ke user ini dilepas

  insert into activity_logs (project_id, actor_id, action_type, new_value, metadata)
  values (p_project, auth.uid(), 'member_removed',
          (select full_name from profiles where id = p_user), jsonb_build_object('role', v_cur, 'user_id', p_user));
end $$;

-- Buat link undangan. p_project null = undangan organisasi.
create function public.create_invite(
  p_org uuid default null, p_project uuid default null, p_division uuid default null,
  p_expires_days integer default 7, p_max_uses integer default null
) returns text
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_token text; v_div uuid := p_division; v_my_org org_role; v_my_proj project_role;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if p_expires_days is null or p_expires_days < 1 or p_expires_days > 30 then
    raise exception 'Masa berlaku link harus antara 1 sampai 30 hari';
  end if;
  if p_max_uses is not null and p_max_uses < 1 then raise exception 'Batas pemakaian minimal 1'; end if;

  if p_project is not null then
    v_org := public.project_org(p_project);
    if v_org is null then raise exception 'Project tidak ditemukan'; end if;
    v_my_proj := public.project_role_of(p_project);
    if not (coalesce(v_my_proj in ('project_manager', 'wakil_project_manager', 'pic', 'koordinator'), false)
            or coalesce(public.is_org_manager(v_org), false)) then
      raise exception 'Hanya Project Manager, Wakil Project Manager, PIC, atau Koordinator yang dapat membuat link undangan project';
    end if;
    if v_div is not null and not exists (select 1 from project_divisions where id = v_div and project_id = p_project) then
      raise exception 'Divisi tidak ditemukan di project ini';
    end if;
  else
    v_org := p_org;
    if v_org is null then raise exception 'Organisasi tidak ditemukan'; end if;
    v_my_org := public.org_role_of(v_org);
    if v_my_org is null or v_my_org not in ('ketua', 'wakil_ketua', 'koordinator') then
      raise exception 'Hanya Ketua, Wakil Ketua, atau Koordinator yang dapat membuat link undangan organisasi';
    end if;
    v_div := null;
  end if;

  insert into invites (organization_id, project_id, division_id, created_by, expires_at, max_uses)
  values (v_org, p_project, v_div, auth.uid(), now() + make_interval(days => p_expires_days), p_max_uses)
  returning token into v_token;
  return v_token;
end $$;

create function public.revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_inv invites;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  select * into v_inv from invites where id = p_invite;
  if not found then raise exception 'Link undangan tidak ditemukan'; end if;
  if not (v_inv.created_by = auth.uid()
          or coalesce(public.is_org_manager(v_inv.organization_id), false)
          or (v_inv.project_id is not null and coalesce(public.is_project_manager(v_inv.project_id), false))) then
    raise exception 'Kamu tidak berhak mencabut link ini';
  end if;
  update invites set revoked_at = now() where id = p_invite and revoked_at is null;
end $$;

-- Pratinjau undangan (boleh dipanggil sebelum login agar halaman undangan bisa menampilkan detailnya)
create function public.invite_preview(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_inv invites; v_org text; v_proj text; v_div text; v_by text; v_reason text;
begin
  select * into v_inv from invites where token = p_token;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'Link undangan tidak ditemukan.');
  end if;

  select name into v_org from organizations where id = v_inv.organization_id;
  select name into v_proj from projects where id = v_inv.project_id;
  select name into v_div from project_divisions where id = v_inv.division_id;
  select full_name into v_by from profiles where id = v_inv.created_by;

  if v_inv.revoked_at is not null then
    v_reason := 'Link undangan ini sudah dicabut.';
  elsif v_inv.expires_at < now() then
    v_reason := 'Link undangan ini sudah kedaluwarsa.';
  elsif v_inv.max_uses is not null and v_inv.uses_count >= v_inv.max_uses then
    v_reason := 'Kuota pemakaian link undangan ini sudah habis.';
  end if;

  return jsonb_build_object(
    'valid', v_reason is null, 'reason', v_reason,
    'organization_name', v_org, 'project_name', v_proj,
    'division_name', v_div, 'inviter_name', v_by
  );
end $$;

-- Gabung lewat link undangan. Link project otomatis memasukkan user ke organisasi (sebagai Member) bila belum.
create function public.accept_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_inv invites;
  v_in_org boolean; v_in_proj boolean := false; v_new_org boolean := false; v_new_proj boolean := false;
  v_rows integer;
begin
  if v_uid is null then raise exception 'Silakan masuk terlebih dahulu'; end if;

  select * into v_inv from invites where token = p_token for update;
  if not found then raise exception 'Link undangan tidak ditemukan'; end if;
  if v_inv.revoked_at is not null then raise exception 'Link undangan ini sudah dicabut'; end if;
  if v_inv.expires_at < now() then raise exception 'Link undangan ini sudah kedaluwarsa'; end if;

  select exists (select 1 from organization_members where organization_id = v_inv.organization_id and user_id = v_uid)
    into v_in_org;
  if v_inv.project_id is not null then
    select exists (select 1 from project_members where project_id = v_inv.project_id and user_id = v_uid)
      into v_in_proj;
  end if;

  -- Kuota hanya dihitung jika link ini benar-benar menambah anggota baru
  if (not v_in_org or (v_inv.project_id is not null and not v_in_proj))
     and v_inv.max_uses is not null and v_inv.uses_count >= v_inv.max_uses then
    raise exception 'Kuota pemakaian link undangan ini sudah habis';
  end if;

  if not v_in_org then
    insert into organization_members (organization_id, user_id, role)
    values (v_inv.organization_id, v_uid, 'member')
    on conflict (organization_id, user_id) do nothing;
    get diagnostics v_rows = row_count;
    v_new_org := v_rows > 0;
  end if;

  if v_inv.project_id is not null and not v_in_proj then
    insert into project_members (project_id, user_id, role, division_id, notification_level)
    values (v_inv.project_id, v_uid, 'member', v_inv.division_id, 'important')
    on conflict (project_id, user_id) do nothing;
    get diagnostics v_rows = row_count;
    v_new_proj := v_rows > 0;

    if v_new_proj then
      insert into activity_logs (project_id, actor_id, action_type, new_value, metadata)
      values (v_inv.project_id, v_uid, 'member_added',
              (select full_name from profiles where id = v_uid),
              jsonb_build_object('role', 'member', 'via_invite', true));
    end if;
  end if;

  if v_new_org or v_new_proj then
    update invites set uses_count = uses_count + 1 where id = v_inv.id;
  end if;

  return jsonb_build_object(
    'organization_id', v_inv.organization_id,
    'project_id', v_inv.project_id,
    'joined', v_new_org or v_new_proj
  );
end $$;

-- ------------------------------------------------------------
-- 8. Backfill: Ketua organisasi menjadi viewer di semua project yang sudah ada
-- ------------------------------------------------------------
insert into project_members (project_id, user_id, role, notification_level)
select p.id, om.user_id, 'ketua', 'important'
from projects p
join organization_members om on om.organization_id = p.organization_id and om.role = 'ketua'
on conflict (project_id, user_id) do update
  set role = 'ketua', division_id = null
  where project_members.role <> 'project_manager';

-- ------------------------------------------------------------
-- 9. RLS policy (ditulis ulang)
-- ------------------------------------------------------------
-- profiles
create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- organizations (dibuat lewat create_organization)
create policy organizations_select on organizations for select to authenticated
  using (public.is_org_member(id));
create policy organizations_update on organizations for update to authenticated
  using (public.is_org_manager(id)) with check (public.is_org_manager(id));

-- organization_members (diubah lewat fungsi set_org_member / remove_org_member / transfer_ketua / accept_invite)
create policy org_members_select on organization_members for select to authenticated
  using (public.is_org_member(organization_id));

-- projects (dibuat lewat create_project)
create policy projects_select on projects for select to authenticated
  using (public.is_org_member(organization_id));
create policy projects_update on projects for update to authenticated
  using (public.is_project_manager(id)) with check (public.is_project_manager(id));

-- project_members (diubah lewat fungsi; user hanya boleh mengubah preferensi notifikasinya sendiri)
create policy project_members_select on project_members for select to authenticated
  using (public.is_project_member(project_id));
create policy project_members_update_own on project_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- project_divisions
create policy divisions_select on project_divisions for select to authenticated
  using (public.is_project_member(project_id));
create policy divisions_insert on project_divisions for insert to authenticated
  with check (public.is_project_manager(project_id));
create policy divisions_update on project_divisions for update to authenticated
  using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));
create policy divisions_delete on project_divisions for delete to authenticated
  using (public.is_project_manager(project_id));

-- tasks & comments: semua anggota boleh melihat; Ketua (viewer) tidak boleh mengubah
create policy tasks_select on tasks for select to authenticated
  using (public.is_project_member(project_id));
create policy tasks_insert on tasks for insert to authenticated
  with check (public.is_project_writer(project_id) and created_by = auth.uid());
create policy tasks_update on tasks for update to authenticated
  using (public.is_project_writer(project_id)) with check (public.is_project_writer(project_id));

create policy comments_select on comments for select to authenticated
  using (exists (select 1 from tasks t where t.id = task_id and public.is_project_member(t.project_id)));
create policy comments_insert on comments for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from tasks t where t.id = task_id and public.is_project_writer(t.project_id)));

-- activity_logs & notification_logs: hanya dibaca (ditulis oleh server)
create policy activity_select on activity_logs for select to authenticated
  using (public.is_project_member(project_id));
create policy notification_logs_select on notification_logs for select to authenticated
  using (public.is_project_member(project_id));

-- notifications (in-app)
create policy notifications_select_own on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- announcements: dilihat semua anggota project (termasuk pembuatnya); diedit/dihapus oleh pembuat atau PM/Wakil PM
create policy announcements_select on announcements for select to authenticated
  using (public.is_project_member(project_id));
create policy announcements_insert on announcements for insert to authenticated
  with check (author_id = auth.uid() and public.can_post_announcement(project_id));
create policy announcements_update on announcements for update to authenticated
  using (author_id = auth.uid() or public.is_project_manager(project_id))
  with check (author_id = auth.uid() or public.is_project_manager(project_id));
create policy announcements_delete on announcements for delete to authenticated
  using (author_id = auth.uid() or public.is_project_manager(project_id));

-- invites: hanya pembuat & pengurus yang bisa melihat daftar link (dibuat/dicabut lewat fungsi)
create policy invites_select on invites for select to authenticated
  using (created_by = auth.uid()
         or public.is_org_manager(organization_id)
         or (project_id is not null and public.is_project_manager(project_id)));

-- ------------------------------------------------------------
-- 10. Pembatasan kolom & hak eksekusi fungsi
-- ------------------------------------------------------------
-- Client hanya boleh mengubah kolom tertentu (kolom lain hanya lewat fungsi di atas)
revoke update on profiles from authenticated;
grant update (full_name, avatar_url) on profiles to authenticated;
revoke update on project_members from authenticated;
grant update (notification_level) on project_members to authenticated;
revoke update on announcements from authenticated;
grant update (title, body, updated_at) on announcements to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'org_role_of(uuid)', 'is_org_member(uuid)', 'is_org_manager(uuid)', 'project_org(uuid)',
    'project_role_of(uuid)', 'is_project_member(uuid)', 'is_project_writer(uuid)',
    'is_project_manager(uuid)', 'can_post_announcement(uuid)',
    'create_organization(text,text)', 'set_org_member(uuid,uuid,org_role)', 'remove_org_member(uuid,uuid)',
    'transfer_ketua(uuid,uuid)', 'create_project(uuid,text,text,date,date,uuid)', 'join_project(uuid)',
    'set_project_member(uuid,uuid,project_role,uuid)', 'remove_project_member(uuid,uuid)',
    'create_invite(uuid,uuid,uuid,integer,integer)', 'revoke_invite(uuid)', 'accept_invite(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- Pratinjau undangan boleh dipanggil sebelum login
revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated, service_role;

commit;
