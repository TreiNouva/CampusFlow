-- ============================================================
-- CampusFlow v8 — 0005
--   1. Paket & pembayaran (MODE DEMO — belum terhubung ke payment gateway)
--      * organization_subscriptions : paket aktif per organisasi
--      * billing_payments           : riwayat pembayaran (simulasi)
--      * Kuota ditegakkan database: anggota organisasi & project aktif
--   2. Interest check festival: interest_signups + submit_interest()
--   3. Pengetatan keamanan sesuai Supabase Security Advisor
-- Jalankan SETELAH 0001–0004.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Paket
-- ------------------------------------------------------------
-- Harga (Rupiah). Harus sama dengan lib/plans.ts.
--   Gratis      : 15 anggota, 2 project aktif, Rp0
--   Organisasi  : 30 anggota + 10 per paket tambahan, project tak terbatas
--                 Rp49.000/bulan + Rp10.000/bulan per tambahan 10 anggota
--                 Tahunan = 10 × harga bulanan (gratis 2 bulan)
--   Kampus      : tanpa batas, lewat kesepakatan (tidak bisa dibeli mandiri)

create table if not exists organization_subscriptions (
  organization_id uuid primary key references organizations (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'organization', 'campus')),
  seat_packs integer not null default 0 check (seat_packs between 0 and 50),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  current_period_end timestamptz,
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now()
);

create table if not exists billing_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  plan text not null,
  seat_packs integer not null default 0,
  billing_cycle text not null,
  amount integer not null check (amount >= 0),
  method text not null default 'qris_demo',
  status text not null default 'demo_paid' check (status in ('demo_paid', 'cancelled')),
  paid_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists billing_payments_org_idx on billing_payments (organization_id, created_at desc);

alter table organization_subscriptions enable row level security;
alter table billing_payments enable row level security;

-- Semua anggota organisasi boleh melihat paketnya; tidak ada policy tulis:
-- perubahan hanya lewat fungsi di bawah (tidak bisa "upgrade gratis" lewat REST).
drop policy if exists "subscriptions_select_member" on organization_subscriptions;
create policy "subscriptions_select_member" on organization_subscriptions
  for select to authenticated using (public.is_org_member(organization_id));

-- Riwayat pembayaran hanya untuk pengurus yang mengelola paket.
create or replace function public.can_manage_billing(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.org_role_of(p_org) in ('ketua', 'wakil_ketua', 'bendahara'), false);
$$;
revoke execute on function public.can_manage_billing(uuid) from public, anon;
grant execute on function public.can_manage_billing(uuid) to authenticated;

drop policy if exists "payments_select_manager" on billing_payments;
create policy "payments_select_manager" on billing_payments
  for select to authenticated using (public.can_manage_billing(organization_id));

-- Paket efektif (paket yang masa aktifnya habis kembali ke Gratis).
create or replace function public.org_effective_plan(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.plan from organization_subscriptions s
    where s.organization_id = p_org
      and (s.plan = 'free' or s.plan = 'campus' or s.current_period_end is null or s.current_period_end > now())
  ), 'free');
$$;

-- Batas anggota (null = tanpa batas).
create or replace function public.org_member_limit(p_org uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case public.org_effective_plan(p_org)
    when 'free' then 15
    when 'organization' then 30 + 10 * coalesce((select seat_packs from organization_subscriptions where organization_id = p_org), 0)
    else null
  end;
$$;

-- Batas project aktif (null = tanpa batas). Aktif = belum lewat tanggal selesai (WIB).
create or replace function public.org_project_limit(p_org uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case public.org_effective_plan(p_org) when 'free' then 2 else null end;
$$;

create or replace function public.org_active_project_count(p_org uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from projects
  where organization_id = p_org
    and (end_date is null or end_date >= (now() at time zone 'Asia/Jakarta')::date);
$$;

revoke execute on function public.org_effective_plan(uuid) from public, anon;
revoke execute on function public.org_member_limit(uuid) from public, anon;
revoke execute on function public.org_project_limit(uuid) from public, anon;
revoke execute on function public.org_active_project_count(uuid) from public, anon;
grant execute on function public.org_effective_plan(uuid) to authenticated;
grant execute on function public.org_member_limit(uuid) to authenticated;
grant execute on function public.org_project_limit(uuid) to authenticated;
grant execute on function public.org_active_project_count(uuid) to authenticated;

-- Harga dihitung di server; angka dari browser tidak dipercaya.
create or replace function public.plan_price(p_plan text, p_seat_packs integer, p_cycle text) returns integer
language sql immutable as $$
  select case
    when p_plan = 'organization' then
      (49000 + 10000 * greatest(coalesce(p_seat_packs, 0), 0)) * (case when p_cycle = 'yearly' then 10 else 1 end)
    else 0
  end;
$$;

-- Kuota anggota: dicek setiap ada anggota BARU (undangan, tambah manual, insert langsung).
create or replace function public.enforce_member_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_limit integer; v_count integer;
begin
  -- Ubah jabatan anggota lama (insert ... on conflict do update) tidak dihitung.
  if exists (select 1 from organization_members where organization_id = new.organization_id and user_id = new.user_id) then
    return new;
  end if;
  v_limit := public.org_member_limit(new.organization_id);
  if v_limit is null then return new; end if;
  select count(*) into v_count from organization_members where organization_id = new.organization_id;
  if v_count >= v_limit then
    raise exception 'Kuota anggota organisasi penuh (% anggota). Ketua atau Bendahara dapat menambah kuota di menu Paket & Pembayaran.', v_limit;
  end if;
  return new;
end $$;
drop trigger if exists trg_org_members_quota on organization_members;
create trigger trg_org_members_quota before insert on organization_members
  for each row execute procedure public.enforce_member_quota();

create or replace function public.enforce_project_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_limit integer;
begin
  v_limit := public.org_project_limit(new.organization_id);
  if v_limit is null then return new; end if;
  if public.org_active_project_count(new.organization_id) >= v_limit then
    raise exception 'Paket Gratis hanya untuk % project aktif. Upgrade ke paket Organisasi untuk project tanpa batas.', v_limit;
  end if;
  return new;
end $$;
drop trigger if exists trg_projects_quota on projects;
create trigger trg_projects_quota before insert on projects
  for each row execute procedure public.enforce_project_quota();

-- Aktivasi paket (DEMO: "Saya sudah bayar" langsung mengaktifkan paket).
-- Saat payment gateway terhubung, fungsi ini dipanggil dari webhook pembayaran, bukan dari browser.
create or replace function public.activate_plan_demo(p_org uuid, p_plan text, p_seat_packs integer, p_cycle text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_amount integer; v_end timestamptz; v_members integer; v_payment uuid;
begin
  if v_uid is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if not public.can_manage_billing(p_org) then
    raise exception 'Hanya Ketua, Wakil Ketua, atau Bendahara yang dapat mengubah paket';
  end if;
  if p_plan <> 'organization' then raise exception 'Paket ini tidak bisa dibeli mandiri'; end if;
  if p_cycle not in ('monthly', 'yearly') then raise exception 'Periode tagihan tidak valid'; end if;
  if p_seat_packs is null or p_seat_packs < 0 or p_seat_packs > 50 then raise exception 'Jumlah tambahan anggota tidak valid'; end if;

  select count(*) into v_members from organization_members where organization_id = p_org;
  if v_members > 30 + 10 * p_seat_packs then
    raise exception 'Organisasi ini punya % anggota. Pilih minimal % tambahan 10 anggota.',
      v_members, ceil((v_members - 30) / 10.0)::int;
  end if;

  v_amount := public.plan_price(p_plan, p_seat_packs, p_cycle);
  v_end := now() + case when p_cycle = 'yearly' then interval '1 year' else interval '1 month' end;

  insert into billing_payments (organization_id, plan, seat_packs, billing_cycle, amount, paid_by)
  values (p_org, p_plan, p_seat_packs, p_cycle, v_amount, v_uid)
  returning id into v_payment;

  insert into organization_subscriptions (organization_id, plan, seat_packs, billing_cycle, current_period_end, updated_by, updated_at)
  values (p_org, p_plan, p_seat_packs, p_cycle, v_end, v_uid, now())
  on conflict (organization_id) do update
    set plan = excluded.plan, seat_packs = excluded.seat_packs, billing_cycle = excluded.billing_cycle,
        current_period_end = excluded.current_period_end, updated_by = excluded.updated_by, updated_at = now();

  return jsonb_build_object('payment_id', v_payment, 'amount', v_amount, 'period_end', v_end);
end $$;

-- Kembali ke paket Gratis (demo). Anggota lama tidak dikeluarkan; hanya penambahan baru yang tertahan.
create or replace function public.cancel_plan_demo(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  if not public.can_manage_billing(p_org) then
    raise exception 'Hanya Ketua, Wakil Ketua, atau Bendahara yang dapat mengubah paket';
  end if;
  insert into organization_subscriptions (organization_id, plan, seat_packs, current_period_end, updated_by)
  values (p_org, 'free', 0, null, auth.uid())
  on conflict (organization_id) do update
    set plan = 'free', seat_packs = 0, current_period_end = null, updated_by = auth.uid(), updated_at = now();
end $$;

revoke execute on function public.activate_plan_demo(uuid, text, integer, text) from public, anon;
revoke execute on function public.cancel_plan_demo(uuid) from public, anon;
grant execute on function public.activate_plan_demo(uuid, text, integer, text) to authenticated;
grant execute on function public.cancel_plan_demo(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. Interest check (festival)
-- ------------------------------------------------------------
create table if not exists interest_signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organization_name text,
  organization_type text check (organization_type in ('bem', 'himpunan', 'ukm', 'kepanitiaan', 'lainnya')),
  member_count integer check (member_count between 1 and 10000),
  interested_plan text not null default 'free' check (interested_plan in ('free', 'organization', 'campus', 'belum_tahu')),
  willing_to_pay boolean,
  note text,
  source text not null default 'web' check (source in ('web', 'festival', 'app')),
  user_id uuid references profiles (id) on delete set null,
  organization_id uuid references organizations (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists interest_signups_created_idx on interest_signups (created_at desc);

-- Tanpa policy: tabel hanya bisa dibaca server (service role) untuk halaman rekap tim.
alter table interest_signups enable row level security;

create or replace function public.submit_interest(
  p_name text, p_email text, p_org_name text, p_org_type text, p_member_count integer,
  p_plan text, p_willing_to_pay boolean, p_note text, p_source text, p_org uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'Nama wajib diisi (2–80 karakter)'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 120 then raise exception 'Format email tidak valid'; end if;
  if char_length(coalesce(p_org_name, '')) > 120 then raise exception 'Nama organisasi terlalu panjang'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'Catatan maksimal 500 karakter'; end if;
  if p_org is not null and not public.is_org_member(p_org) then p_org := null; end if;

  -- Cegah spam sederhana: email yang sama hanya tercatat sekali per 10 menit.
  if exists (select 1 from interest_signups where email = v_email and created_at > now() - interval '10 minutes') then
    select id into v_id from interest_signups where email = v_email order by created_at desc limit 1;
    return v_id;
  end if;

  insert into interest_signups (name, email, organization_name, organization_type, member_count, interested_plan,
                                willing_to_pay, note, source, user_id, organization_id)
  values (btrim(p_name), v_email, nullif(btrim(coalesce(p_org_name, '')), ''), nullif(p_org_type, ''), p_member_count,
          coalesce(nullif(p_plan, ''), 'belum_tahu'), p_willing_to_pay, nullif(btrim(coalesce(p_note, '')), ''),
          coalesce(nullif(p_source, ''), 'web'), auth.uid(), p_org)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.submit_interest(text, text, text, text, integer, text, boolean, text, text, uuid) from public;
grant execute on function public.submit_interest(text, text, text, text, integer, text, boolean, text, text, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 3. Keamanan (Supabase Security Advisor)
-- ------------------------------------------------------------
-- Fungsi trigger tidak perlu bisa dipanggil lewat /rest/v1/rpc. Trigger tetap berjalan
-- karena Postgres tidak memeriksa hak EXECUTE saat trigger dipicu.
do $$
declare f text;
begin
  foreach f in array array[
    'public.add_ketua_to_new_project()', 'public.check_event_period()', 'public.check_milestone_period()',
    'public.check_task_assignee()', 'public.check_task_member_scope()', 'public.check_task_period()',
    'public.handle_new_user()', 'public.sync_org_member_projects()', 'public.unassign_tasks_of_removed_member()',
    'public.set_task_completed_at()', 'public.set_updated_at()',
    'public.enforce_member_quota()', 'public.enforce_project_quota()',
    'public.assert_in_project_period(uuid, date, text)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
    end if;
  end loop;
end $$;

-- search_path tetap untuk fungsi yang belum punya.
do $$
declare f text;
begin
  foreach f in array array[
    'public.handle_new_user()', 'public.set_updated_at()', 'public.set_task_completed_at()',
    'public.fmt_id_date(date)', 'public.plan_price(text, integer, text)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = public', f);
    end if;
  end loop;
end $$;
