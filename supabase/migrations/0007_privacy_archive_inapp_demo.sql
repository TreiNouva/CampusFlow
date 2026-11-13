-- ============================================================================
-- CampusFlow v8.3 — migrasi 0007
--   1. BUG FIX: tutorial selesai tidak pernah tersimpan (kolom onboarded_at tidak
--      boleh di-update oleh user sejak hardening 0002). Akibatnya tur muncul lagi
--      di setiap perangkat/browser baru.
--   2. PRIVASI: profil (nama + email) hanya terlihat oleh orang yang satu
--      organisasi atau satu project. Sebelumnya semua user login bisa membaca
--      seluruh daftar email pengguna lewat API.
--   3. ARSIP PROJECT: project bisa diarsipkan (status 'archived'). Project arsip
--      jadi read-only dan tidak dihitung dalam kuota project aktif.
--   4. NOTIFIKASI IN-APP: kolom link + hapus milik sendiri.
--   5. DATA CONTOH: create_demo_workspace() membuat 1 organisasi contoh lengkap
--      (project, divisi, task, acara, milestone, budget, pengumuman) untuk demo.
-- Aman dijalankan ulang (idempotent).
-- ============================================================================

-- 1. onboarded_at ------------------------------------------------------------
grant update (onboarded_at) on profiles to authenticated;

-- 2. Profil hanya untuk rekan satu organisasi / project ------------------------
create or replace function public.can_see_profile(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = (select auth.uid())
      or exists (
        select 1 from organization_members a
        join organization_members b on b.organization_id = a.organization_id
        where a.user_id = (select auth.uid()) and b.user_id = p_user)
      or exists (
        select 1 from project_members a
        join project_members b on b.project_id = a.project_id
        where a.user_id = (select auth.uid()) and b.user_id = p_user)
$$;
revoke execute on function public.can_see_profile(uuid) from public, anon;
grant execute on function public.can_see_profile(uuid) to authenticated;

drop policy if exists profiles_select on profiles;
drop policy if exists "profiles_select_authenticated" on profiles;
create policy profiles_select on profiles for select to authenticated
  using (public.can_see_profile(id));

-- 3. Arsip project -------------------------------------------------------------
-- Project arsip tidak dihitung sebagai project aktif.
create or replace function public.org_active_project_count(p_org uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from projects
  where organization_id = p_org
    and coalesce(status, 'active') <> 'archived'
    and (end_date is null or end_date >= (now() at time zone 'Asia/Jakarta')::date);
$$;

create or replace function public.set_project_archived(p_project uuid, p_archived boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid; v_end date; v_status text; v_role project_role; v_limit int;
begin
  if v_uid is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  select organization_id, end_date, status into v_org, v_end, v_status from projects where id = p_project;
  if v_org is null then raise exception 'Project tidak ditemukan'; end if;
  select role into v_role from project_members where project_id = p_project and user_id = v_uid;
  if not (coalesce(v_role in ('project_manager', 'wakil_project_manager'), false)
          or coalesce(public.org_role_of(v_org) in ('ketua', 'wakil_ketua'), false)) then
    raise exception 'Hanya Project Manager, Wakil PM, atau Ketua/Wakil Ketua organisasi yang dapat mengarsipkan project';
  end if;

  if p_archived then
    if v_status = 'archived' then return; end if;
    update projects set status = 'archived', updated_at = now() where id = p_project;
  else
    if coalesce(v_status, 'active') <> 'archived' then return; end if;
    -- Membuka arsip = project aktif lagi, jadi kuota dicek (kecuali project sudah lewat tanggal selesai).
    if v_end is null or v_end >= (now() at time zone 'Asia/Jakarta')::date then
      v_limit := public.org_project_limit(v_org);
      if v_limit is not null and public.org_active_project_count(v_org) >= v_limit then
        raise exception 'Kuota project aktif penuh (% project). Arsipkan project lain atau upgrade paket dulu.', v_limit;
      end if;
    end if;
    update projects set status = 'active', updated_at = now() where id = p_project;
  end if;

  insert into activity_logs (project_id, actor_id, action_type, new_value)
  values (p_project, v_uid, 'project_updated', case when p_archived then 'Project diarsipkan' else 'Arsip project dibuka' end);
end $$;
revoke execute on function public.set_project_archived(uuid, boolean) from public, anon;
grant execute on function public.set_project_archived(uuid, boolean) to authenticated;

-- Project arsip = read-only untuk user (service role / proses internal tetap bisa).
create or replace function public.guard_archived_project() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select status into v_status from projects where id = coalesce(new.project_id, old.project_id);
  if v_status = 'archived' then
    raise exception 'Project ini sudah diarsipkan (hanya bisa dilihat). Buka arsip di Pengaturan Project untuk mengubah.';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['tasks', 'announcements', 'project_events', 'project_milestones',
                           'budget_entries', 'budget_plans', 'documents', 'project_divisions'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_%s_archived on %I', t, t);
      execute format('create trigger trg_%s_archived before insert or update or delete on %I
                      for each row execute function public.guard_archived_project()', t, t);
    end if;
  end loop;
end $$;

-- update_project juga ditolak untuk project arsip.
create or replace function public.guard_archived_project_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.status = 'archived' and new.status = 'archived' then
    raise exception 'Project ini sudah diarsipkan (hanya bisa dilihat). Buka arsip di Pengaturan Project untuk mengubah.';
  end if;
  return new;
end $$;
drop trigger if exists trg_projects_archived on projects;
create trigger trg_projects_archived before update on projects
  for each row execute function public.guard_archived_project_row();

-- 4. Notifikasi in-app ----------------------------------------------------------
alter table notifications add column if not exists link text;
create index if not exists idx_notifications_user_unread on notifications (user_id, is_read, created_at desc);
drop policy if exists notifications_delete_own on notifications;
create policy notifications_delete_own on notifications for delete to authenticated
  using (user_id = (select auth.uid()));
-- Insert hanya lewat server (service role). User hanya boleh menandai sudah dibaca.
revoke insert on notifications from authenticated, anon;
revoke update on notifications from authenticated, anon;
grant update (is_read) on notifications to authenticated;

-- 5. Data contoh -----------------------------------------------------------------
alter table organizations add column if not exists is_demo boolean not null default false;

create or replace function public.create_demo_workspace() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid; v_proj uuid; v_acara uuid; v_humas uuid; v_dana uuid;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_start date; v_end date;
begin
  if v_uid is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if exists (select 1 from organizations where created_by = v_uid and is_demo) then
    raise exception 'Kamu sudah punya organisasi contoh. Hapus dulu di Pengaturan Organisasi jika ingin membuat ulang.';
  end if;

  v_start := v_today - 14;
  v_end := v_today + 21;

  v_org := public.create_organization('Contoh: Himpunan Demo',
    'Organisasi contoh berisi data dummy untuk mencoba fitur CampusFlow. Aman dihapus kapan saja.');
  update organizations set is_demo = true where id = v_org;

  v_proj := public.create_project(v_org, 'Festival Teknologi Kampus',
    'Acara tahunan himpunan: seminar, lomba, dan booth startup mahasiswa.', v_start, v_end, v_uid);

  insert into project_divisions (project_id, name, created_by) values (v_proj, 'Acara', v_uid) returning id into v_acara;
  insert into project_divisions (project_id, name, created_by) values (v_proj, 'Humas', v_uid) returning id into v_humas;
  insert into project_divisions (project_id, name, created_by) values (v_proj, 'Dana Usaha', v_uid) returning id into v_dana;

  insert into tasks (project_id, title, description, assignee_id, status, priority, start_date, due_date, division_id, created_by) values
    (v_proj, 'Booking venue auditorium', 'Konfirmasi ke biro umum, lampirkan surat peminjaman.', v_uid, 'done', 'high', v_start, v_start + 5, v_acara, v_uid),
    (v_proj, 'Susun rundown acara', null, v_uid, 'in_progress', 'high', v_today - 3, v_today + 2, v_acara, v_uid),
    (v_proj, 'Hubungi 3 pembicara seminar', null, v_uid, 'review', 'medium', v_today - 5, v_today + 1, v_acara, v_uid),
    (v_proj, 'Desain poster & feed Instagram', null, v_uid, 'in_progress', 'medium', v_today - 2, v_today + 4, v_humas, v_uid),
    (v_proj, 'Kirim proposal sponsor', 'Target 5 perusahaan.', v_uid, 'todo', 'urgent', v_today, v_today + 3, v_dana, v_uid),
    (v_proj, 'Rekap pendaftar lomba', null, null, 'todo', 'low', v_today + 2, v_today + 10, v_acara, v_uid),
    (v_proj, 'Siapkan konsumsi panitia', null, null, 'todo', 'medium', v_today + 10, v_end - 2, v_dana, v_uid);

  insert into project_events (project_id, division_id, title, location, start_at, end_at, created_by) values
    (v_proj, null, 'Rapat koordinasi besar', 'Ruang himpunan', (v_today + 1) + time '16:00', (v_today + 1) + time '18:00', v_uid),
    (v_proj, v_humas, 'Briefing humas', 'Online (Zoom)', (v_today + 3) + time '19:00', (v_today + 3) + time '20:00', v_uid),
    (v_proj, null, 'Hari H Festival', 'Auditorium kampus', (v_end - 1) + time '08:00', (v_end - 1) + time '17:00', v_uid);

  insert into project_milestones (project_id, title, due_date, created_by) values
    (v_proj, 'Sponsor utama terkunci', v_today + 7, v_uid),
    (v_proj, 'Pendaftaran lomba ditutup', v_today + 14, v_uid);

  insert into budget_plans (project_id, division_id, category, planned_amount, created_by) values
    (v_proj, v_acara, 'Sewa alat & venue', 3500000, v_uid),
    (v_proj, v_humas, 'Publikasi', 750000, v_uid),
    (v_proj, v_dana, 'Konsumsi', 2000000, v_uid);

  insert into budget_entries (project_id, division_id, entry_type, category, amount, note, entry_date, created_by) values
    (v_proj, null, 'income', 'Kas himpunan', 4000000, 'Alokasi kas semester', v_start + 1, v_uid),
    (v_proj, v_dana, 'income', 'Sponsor', 2500000, 'Sponsor A (contoh)', v_today - 4, v_uid),
    (v_proj, v_acara, 'expense', 'Sewa alat & venue', 1500000, 'DP sound system', v_today - 6, v_uid),
    (v_proj, v_humas, 'expense', 'Publikasi', 300000, 'Cetak poster', v_today - 2, v_uid);

  insert into announcements (project_id, author_id, title, body) values
    (v_proj, v_uid, 'Selamat datang di project contoh 👋',
     'Ini data contoh. Coba ubah status task, tambah acara di Kalender, atau catat pengeluaran di Budget. Organisasi contoh bisa dihapus di Pengaturan Organisasi.');

  return v_org;
end $$;
revoke execute on function public.create_demo_workspace() from public, anon;
grant execute on function public.create_demo_workspace() to authenticated;
