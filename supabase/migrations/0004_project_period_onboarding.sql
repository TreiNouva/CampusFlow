-- ============================================================
-- CampusFlow v7 — 0004
--   1. Semua tanggal task, milestone, dan acara wajib berada di dalam periode
--      project (tanggal mulai s.d. tanggal selesai project), jika project
--      punya tanggal. Ditegakkan oleh database, bukan hanya oleh form.
--   2. Tanggal selesai project tidak boleh sebelum tanggal mulai.
--   3. Kolom profiles.onboarded_at untuk tutorial singkat setelah login
--      (tersimpan di akun, jadi tidak muncul lagi di perangkat lain).
-- Jalankan SETELAH 0001–0003.
-- ============================================================

-- 1. Urutan tanggal project -------------------------------------------------
-- NOT VALID: project lama yang mungkin sudah salah tidak membuat migrasi gagal,
-- tetapi insert/update berikutnya tetap dicek.
alter table projects drop constraint if exists projects_dates_order;
alter table projects add constraint projects_dates_order
  check (start_date is null or end_date is null or end_date >= start_date) not valid;

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
  if p_start is not null and p_end is not null and p_end < p_start then
    raise exception 'Tanggal selesai project tidak boleh sebelum tanggal mulai';
  end if;

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

-- 2. Tanggal di dalam periode project ---------------------------------------
-- Helper: pesan error konsisten, dengan tanggal dalam format Indonesia singkat.
create or replace function public.fmt_id_date(d date) returns text
language sql immutable as $$
  select to_char(d, 'DD') || ' ' ||
    (array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month from d)::int]
    || ' ' || to_char(d, 'YYYY')
$$;

create or replace function public.assert_in_project_period(p_project uuid, p_date date, p_label text)
returns void
language plpgsql stable security definer set search_path = public as $$
declare v_start date; v_end date;
begin
  if p_date is null then return; end if;
  select start_date, end_date into v_start, v_end from projects where id = p_project;
  if v_start is not null and p_date < v_start then
    raise exception '% tidak boleh sebelum project dimulai (%)', p_label, public.fmt_id_date(v_start);
  end if;
  if v_end is not null and p_date > v_end then
    raise exception '% tidak boleh setelah project selesai (%)', p_label, public.fmt_id_date(v_end);
  end if;
end $$;

-- Pada UPDATE hanya tanggal yang BERUBAH yang dicek, supaya task lama yang terlanjur di luar
-- periode tetap bisa diubah statusnya tanpa harus memperbaiki tanggalnya dulu.
create or replace function public.check_task_period() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.start_date is distinct from old.start_date then
    perform public.assert_in_project_period(new.project_id, new.start_date, 'Tanggal mulai task');
  end if;
  if tg_op = 'INSERT' or new.due_date is distinct from old.due_date then
    perform public.assert_in_project_period(new.project_id, new.due_date, 'Deadline task');
  end if;
  if new.start_date is not null and new.due_date is not null and new.start_date > new.due_date then
    raise exception 'Tanggal mulai task tidak boleh setelah deadline';
  end if;
  return new;
end $$;
drop trigger if exists trg_tasks_period on tasks;
create trigger trg_tasks_period before insert or update of start_date, due_date on tasks
  for each row execute procedure public.check_task_period();

create or replace function public.check_milestone_period() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_in_project_period(new.project_id, new.due_date, 'Tanggal milestone');
  return new;
end $$;
drop trigger if exists trg_milestones_period on project_milestones;
create trigger trg_milestones_period before insert or update of due_date on project_milestones
  for each row execute procedure public.check_milestone_period();

-- Acara disimpan sebagai timestamptz; dibandingkan sebagai tanggal WIB.
create or replace function public.check_event_period() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_in_project_period(new.project_id, (new.start_at at time zone 'Asia/Jakarta')::date, 'Acara');
  perform public.assert_in_project_period(new.project_id, (new.end_at at time zone 'Asia/Jakarta')::date, 'Acara');
  return new;
end $$;
drop trigger if exists trg_events_period on project_events;
create trigger trg_events_period before insert or update of start_at, end_at on project_events
  for each row execute procedure public.check_event_period();

-- 3. Tutorial setelah login --------------------------------------------------
alter table profiles add column if not exists onboarded_at timestamptz;
