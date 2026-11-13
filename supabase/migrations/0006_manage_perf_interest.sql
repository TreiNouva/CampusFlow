-- ============================================================
-- CampusFlow v8.2 — 0006
--   1. Kelola project & organisasi: edit, hapus, keluar organisasi
--   2. Interest check hanya lewat server (anti-spam): anon tidak bisa memanggil langsung
--   3. Performa: auth.uid() di RLS dievaluasi sekali per query, index untuk foreign key
-- Jalankan SETELAH 0001–0005. Aman dijalankan ulang.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kelola project & organisasi
-- ------------------------------------------------------------

alter type activity_action add value if not exists 'project_updated';

-- Edit project: Project Manager, Wakil PM, atau Ketua/Wakil Ketua organisasi.
-- Periode baru tidak boleh membuat task/acara/milestone yang sudah ada jadi di luar periode.
create or replace function public.update_project(
  p_project uuid, p_name text, p_description text, p_start date, p_end date
) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_bad integer;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  select organization_id into v_org from projects where id = p_project;
  if v_org is null then raise exception 'Project tidak ditemukan'; end if;
  if not (public.is_project_manager(p_project) or public.is_org_manager(v_org)) then
    raise exception 'Hanya Project Manager, Wakil PM, atau Ketua yang dapat mengubah project';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 3 then raise exception 'Nama project minimal 3 karakter'; end if;
  if char_length(coalesce(p_description, '')) > 2000 then raise exception 'Deskripsi maksimal 2000 karakter'; end if;
  if p_start is not null and p_end is not null and p_end < p_start then
    raise exception 'Tanggal selesai project tidak boleh sebelum tanggal mulai';
  end if;

  select
    (select count(*) from tasks where project_id = p_project and (
       (p_start is not null and ((due_date is not null and due_date < p_start) or (start_date is not null and start_date < p_start)))
       or (p_end is not null and ((due_date is not null and due_date > p_end) or (start_date is not null and start_date > p_end)))))
  + (select count(*) from project_milestones where project_id = p_project and (
       (p_start is not null and due_date < p_start) or (p_end is not null and due_date > p_end)))
  + (select count(*) from project_events where project_id = p_project and (
       (p_start is not null and (start_at at time zone 'Asia/Jakarta')::date < p_start)
       or (p_end is not null and (end_at at time zone 'Asia/Jakarta')::date > p_end)))
  into v_bad;
  if v_bad > 0 then
    raise exception '% task/acara/milestone akan berada di luar periode baru. Pindahkan tanggalnya dulu, lalu ubah periode project.', v_bad;
  end if;

  update projects
     set name = btrim(p_name),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         start_date = p_start,
         end_date = p_end,
         updated_at = now()
   where id = p_project;

  insert into activity_logs (project_id, actor_id, action_type, new_value)
  values (p_project, auth.uid(), 'project_updated', btrim(p_name));
end $$;

-- Hapus project: Project Manager (bukan Wakil) atau Ketua organisasi. Nama harus diketik ulang.
create or replace function public.delete_project(p_project uuid, p_confirm_name text) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_name text; v_role project_role;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  select organization_id, name into v_org, v_name from projects where id = p_project;
  if v_org is null then raise exception 'Project tidak ditemukan'; end if;
  select role into v_role from project_members where project_id = p_project and user_id = auth.uid();
  if not (coalesce(v_role = 'project_manager', false) or coalesce(public.org_role_of(v_org) = 'ketua', false)) then
    raise exception 'Hanya Project Manager atau Ketua organisasi yang dapat menghapus project';
  end if;
  if btrim(coalesce(p_confirm_name, '')) <> v_name then
    raise exception 'Nama project yang diketik tidak sama';
  end if;
  delete from projects where id = p_project; -- data project ikut terhapus (cascade)
end $$;

create or replace function public.update_organization(p_org uuid, p_name text, p_description text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if not public.is_org_manager(p_org) then raise exception 'Hanya Ketua atau Wakil Ketua yang dapat mengubah organisasi'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 3 then raise exception 'Nama organisasi minimal 3 karakter'; end if;
  if char_length(coalesce(p_description, '')) > 1000 then raise exception 'Deskripsi maksimal 1000 karakter'; end if;
  update organizations set name = btrim(p_name), description = nullif(btrim(coalesce(p_description, '')), ''), updated_at = now()
  where id = p_org;
end $$;

-- Hapus organisasi: hanya Ketua, nama harus diketik ulang. Semua project & datanya ikut terhapus.
create or replace function public.delete_organization(p_org uuid, p_confirm_name text) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if public.org_role_of(p_org) is distinct from 'ketua' then raise exception 'Hanya Ketua yang dapat menghapus organisasi'; end if;
  select name into v_name from organizations where id = p_org;
  if btrim(coalesce(p_confirm_name, '')) <> v_name then raise exception 'Nama organisasi yang diketik tidak sama'; end if;
  delete from organizations where id = p_org;
end $$;

-- Keluar dari organisasi (Ketua harus mengalihkan jabatan dulu).
create or replace function public.leave_organization(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_role org_role := public.org_role_of(p_org);
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if v_role is null then raise exception 'Kamu bukan anggota organisasi ini'; end if;
  if v_role = 'ketua' then
    raise exception 'Ketua tidak bisa keluar. Alihkan jabatan Ketua ke anggota lain terlebih dahulu, atau hapus organisasi';
  end if;
  delete from organization_members where organization_id = p_org and user_id = auth.uid();
  -- trigger: keanggotaan project ikut terhapus & task-nya dilepas
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.update_project(uuid, text, text, date, date)', 'public.delete_project(uuid, text)',
    'public.update_organization(uuid, text, text)', 'public.delete_organization(uuid, text)',
    'public.leave_organization(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Kolom updated_at dipakai di atas; tambahkan jika belum ada.
alter table projects add column if not exists updated_at timestamptz not null default now();
alter table organizations add column if not exists updated_at timestamptz not null default now();

-- ------------------------------------------------------------
-- 2. Interest check lewat server saja
-- ------------------------------------------------------------
-- Aplikasi memanggil fungsi ini memakai service role (setelah cek honeypot & waktu isi form),
-- jadi bot tidak bisa membanjiri tabel lewat /rest/v1/rpc. User & IP dikirim oleh server.
alter table interest_signups add column if not exists ip_hash text;

drop function if exists public.submit_interest(text, text, text, text, integer, text, boolean, text, text, uuid);
create or replace function public.submit_interest(
  p_name text, p_email text, p_org_name text, p_org_type text, p_member_count integer,
  p_plan text, p_willing_to_pay boolean, p_note text, p_source text,
  p_org uuid default null, p_user uuid default null, p_ip_hash text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'Nama wajib diisi (2–80 karakter)'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 120 then raise exception 'Format email tidak valid'; end if;
  if char_length(coalesce(p_org_name, '')) > 120 then raise exception 'Nama organisasi terlalu panjang'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'Catatan maksimal 500 karakter'; end if;
  if p_org is not null and (p_user is null or not exists (
       select 1 from organization_members where organization_id = p_org and user_id = p_user)) then
    p_org := null;
  end if;

  -- Batas per perangkat/jaringan: 8 isian per 10 menit (cukup untuk booth yang dipakai bergantian).
  if p_ip_hash is not null and (
    select count(*) from interest_signups where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes'
  ) >= 8 then
    raise exception 'Terlalu banyak isian dari perangkat ini. Coba lagi beberapa menit lagi.';
  end if;

  -- Email yang sama dalam 10 menit dianggap isian ganda.
  select id into v_id from interest_signups where email = v_email and created_at > now() - interval '10 minutes'
  order by created_at desc limit 1;
  if v_id is not null then return v_id; end if;

  insert into interest_signups (name, email, organization_name, organization_type, member_count, interested_plan,
                                willing_to_pay, note, source, user_id, organization_id, ip_hash)
  values (btrim(p_name), v_email, nullif(btrim(coalesce(p_org_name, '')), ''), nullif(p_org_type, ''), p_member_count,
          coalesce(nullif(p_plan, ''), 'belum_tahu'), p_willing_to_pay, nullif(btrim(coalesce(p_note, '')), ''),
          coalesce(nullif(p_source, ''), 'web'), p_user, p_org, p_ip_hash)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.submit_interest(text, text, text, text, integer, text, boolean, text, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_interest(text, text, text, text, integer, text, boolean, text, text, uuid, uuid, text) to service_role;

-- ------------------------------------------------------------
-- 3. Performa
-- ------------------------------------------------------------
-- 3a. auth.uid() → (select auth.uid()) di semua policy, agar dihitung sekali per query (bukan per baris).
do $$
declare r record; v_using text; v_check text; v_sql text;
begin
  for r in
    select tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ 'auth\.uid\(\)' or coalesce(with_check, '') ~ 'auth\.uid\(\)')
  loop
    v_using := case when r.qual is null then null
      else regexp_replace(r.qual, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'gi') end;
    v_check := case when r.with_check is null then null
      else regexp_replace(r.with_check, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'gi') end;
    v_sql := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if v_using is not null then v_sql := v_sql || format(' using (%s)', v_using); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
  end loop;
end $$;

-- 3b. Index untuk setiap foreign key satu kolom yang belum punya index awalan kolom itu.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, cl.relname as tname
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and n.nspname = 'public' and array_length(c.conkey, 1) = 1
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
      )
  loop
    execute format('create index if not exists %I on %s (%I)', 'idx_' || r.tname || '_' || r.col, r.tbl, r.col);
  end loop;
end $$;
