-- ============================================================
-- CampusFlow — Seed data untuk demo
-- Skenario: "BINUS Student Festival Committee" (§12 Alur Demo)
--
-- CATATAN: jalankan ini SETELAH kamu membuat 3 user lewat
-- Supabase Auth (Dashboard > Authentication > Add user), lalu
-- ganti UUID di bawah dengan UUID user yang sebenarnya.
-- Trigger on_auth_user_created otomatis mengisi tabel profiles.
--
-- Contoh akun demo yang disarankan:
--   ketua@campusflow.demo       (Admin)
--   koordinator@campusflow.demo (Coordinator)
--   anggota@campusflow.demo     (Member)
-- ============================================================

do $$
declare
  v_admin_id uuid;
  v_coordinator_id uuid;
  v_member_id uuid;
  v_org_id uuid;
  v_project_id uuid;
  v_task_id uuid;
begin
  select id into v_admin_id from profiles where email = 'ketua@campusflow.demo';
  select id into v_coordinator_id from profiles where email = 'koordinator@campusflow.demo';
  select id into v_member_id from profiles where email = 'anggota@campusflow.demo';

  if v_admin_id is null or v_coordinator_id is null or v_member_id is null then
    raise notice 'Lewati seed: buat dulu 3 user demo di Supabase Auth (ketua/koordinator/anggota@campusflow.demo).';
    return;
  end if;

  -- Organization
  insert into organizations (name, description, created_by)
  values ('BINUS Student Festival Committee', 'Panitia gabungan Student Festival kampus.', v_admin_id)
  returning id into v_org_id;

  insert into organization_members (organization_id, user_id, role) values
    (v_org_id, v_admin_id, 'admin'),
    (v_org_id, v_coordinator_id, 'coordinator'),
    (v_org_id, v_member_id, 'member');

  -- Project
  insert into projects (organization_id, name, description, status, start_date, end_date, created_by)
  values (
    v_org_id, 'BINUS Student Festival 2026',
    'Event tahunan gabungan seluruh UKM dan himpunan.',
    'active', current_date, current_date + interval '30 days',
    v_coordinator_id
  ) returning id into v_project_id;

  insert into project_members (project_id, user_id, role, notification_level) values
    (v_project_id, v_admin_id, 'coordinator', 'important'),
    (v_project_id, v_coordinator_id, 'coordinator', 'all'),
    (v_project_id, v_member_id, 'member', 'all');

  -- Tasks
  insert into tasks (project_id, title, description, assignee_id, status, priority, due_date, created_by)
  values
    (v_project_id, 'Finalize Sponsorship Proposal', 'Susun proposal sponsorship untuk 5 calon partner.', v_member_id, 'in_progress', 'high', current_date + 3, v_coordinator_id),
    (v_project_id, 'Booking Venue Auditorium', 'Konfirmasi tanggal & DP venue.', v_coordinator_id, 'todo', 'urgent', current_date + 2, v_coordinator_id),
    (v_project_id, 'Desain Poster & Banner', 'Desain untuk media sosial dan cetak.', v_member_id, 'todo', 'medium', current_date + 7, v_coordinator_id),
    (v_project_id, 'Rekrutmen Volunteer', 'Buka pendaftaran & seleksi volunteer acara.', v_admin_id, 'done', 'medium', current_date - 1, v_admin_id)
  returning id into v_task_id;

  -- Activity log contoh (task terakhir sudah selesai)
  insert into activity_logs (project_id, task_id, actor_id, action_type, old_value, new_value)
  values (v_project_id, v_task_id, v_admin_id, 'task_status_changed', 'in_progress', 'done');

  raise notice 'Seed selesai untuk organisasi %.', v_org_id;
end $$;
