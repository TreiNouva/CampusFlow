-- ============================================================
-- CampusFlow — Seed data untuk demo (setelah migrasi 0001 & 0002)
-- Skenario: "BINUS Student Festival Committee"
--
-- CATATAN: buat dulu 3 user lewat Supabase Auth (Dashboard > Authentication > Add user,
-- centang "Auto Confirm User"). Trigger on_auth_user_created otomatis mengisi tabel profiles.
--   ketua@campusflow.demo       -> Ketua organisasi (otomatis viewer "Ketua" di semua project)
--   koordinator@campusflow.demo -> Project Manager
--   anggota@campusflow.demo     -> PIC divisi Acara
-- ============================================================

do $$
declare
  v_ketua uuid; v_koor uuid; v_member uuid;
  v_org uuid; v_project uuid; v_div_acara uuid; v_div_konsumsi uuid;
begin
  select id into v_ketua from profiles where email = 'ketua@campusflow.demo';
  select id into v_koor from profiles where email = 'koordinator@campusflow.demo';
  select id into v_member from profiles where email = 'anggota@campusflow.demo';

  if v_ketua is null or v_koor is null or v_member is null then
    raise notice 'Lewati seed: buat dulu 3 user demo di Supabase Auth (ketua/koordinator/anggota@campusflow.demo).';
    return;
  end if;

  insert into organizations (name, description, created_by)
  values ('BINUS Student Festival Committee', 'Panitia gabungan Student Festival kampus.', v_ketua)
  returning id into v_org;

  insert into organization_members (organization_id, user_id, role) values
    (v_org, v_ketua, 'ketua'),
    (v_org, v_koor, 'koordinator'),
    (v_org, v_member, 'member');

  -- Project: Project Manager = koordinator. Ketua otomatis ikut sebagai viewer (trigger).
  insert into projects (organization_id, name, description, status, start_date, end_date, created_by)
  values (v_org, 'BINUS Student Festival 2026', 'Event tahunan gabungan seluruh UKM dan himpunan.',
          'active', current_date, current_date + 30, v_koor)
  returning id into v_project;

  insert into project_divisions (project_id, name, created_by) values (v_project, 'Acara', v_koor)
    returning id into v_div_acara;
  insert into project_divisions (project_id, name, created_by) values (v_project, 'Konsumsi', v_koor)
    returning id into v_div_konsumsi;

  insert into project_members (project_id, user_id, role, division_id, notification_level) values
    (v_project, v_koor, 'project_manager', null, 'all'),
    (v_project, v_member, 'pic', v_div_acara, 'all');

  insert into tasks (project_id, title, description, assignee_id, status, priority, due_date, created_by) values
    (v_project, 'Finalize Sponsorship Proposal', 'Susun proposal sponsorship untuk 5 calon partner.', v_member, 'in_progress', 'high', current_date + 3, v_koor),
    (v_project, 'Booking Venue Auditorium', 'Konfirmasi tanggal & DP venue.', v_koor, 'todo', 'urgent', current_date + 2, v_koor),
    (v_project, 'Desain Poster & Banner', 'Desain untuk media sosial dan cetak.', v_member, 'todo', 'medium', current_date + 7, v_koor);

  insert into announcements (project_id, author_id, title, body) values
    (v_project, v_koor, 'Rapat koordinasi perdana', 'Rapat pertama seluruh panitia hari Jumat pukul 16.00 di ruang rapat. Mohon hadir tepat waktu.');

  insert into activity_logs (project_id, actor_id, action_type, new_value)
  values (v_project, v_koor, 'project_created', 'BINUS Student Festival 2026');

  raise notice 'Seed selesai untuk organisasi %.', v_org;
end $$;
