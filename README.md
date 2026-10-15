# CampusFlow — Web Prototype

Prototype web untuk mata kuliah Venture Creation. Dibangun mengikuti
`CampusFlow_Web_Prototype_Specification.docx`, dengan keputusan tim:

- **Platform: web responsif** (bukan aplikasi mobile native).
- **Notifikasi: email** setiap kali ada update penting pada project yang sama —
  bukan notifikasi push/in-app.

Alur inti yang didemokan: **Organization → Project → Task → Activity Log → Email Update**.

---

## 1. Stack Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS |
| Database & Auth | Supabase (PostgreSQL + Supabase Auth) |
| Email | Resend (fallback: mock/log ke console jika API key kosong) |
| Validasi | Zod |
| Deployment | Vercel |

## 2. Struktur Folder

```
campusflow/
├─ app/                     # Halaman (App Router)
│  ├─ (auth)/login, register
│  ├─ dashboard/
│  ├─ organizations/[organizationId]/(members)
│  ├─ projects/[projectId]/(tasks, settings/notifications)
│  └─ api/health/
├─ components/              # UI, dashboard, projects, tasks, layout
├─ lib/                     # supabase client, auth, permissions, email, validations, utils
├─ actions/                 # Server actions (organization, member, project, task, notification, auth)
├─ emails/                  # Template email (task-updated, task-assigned, project-announcement)
├─ types/database.ts        # Tipe TypeScript sesuai skema DB
├─ supabase/
│  ├─ migrations/0001_init.sql   # Skema + Row Level Security
│  └─ seed.sql                   # Data simulasi "BINUS Student Festival Committee"
└─ middleware.ts            # Proteksi route + refresh session
```

## 3. Setup Lokal

### 3.1 Prasyarat
- Node.js ≥ 18.18
- Akun [Supabase](https://supabase.com) (gratis)
- Akun [Resend](https://resend.com) (gratis, opsional untuk demo — lihat §3.4)

### 3.2 Install dependencies

```bash
npm install
```

### 3.3 Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan isi `supabase/migrations/0001_init.sql`.
3. (Opsional, untuk demo) Buat 3 user lewat **Authentication → Add user**:
   - `ketua@campusflow.demo`
   - `koordinator@campusflow.demo`
   - `anggota@campusflow.demo`
4. Jalankan `supabase/seed.sql` di SQL Editor untuk mengisi data simulasi
   "BINUS Student Festival Committee" (lihat catatan di dalam file).
5. Salin `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan
   `SUPABASE_SERVICE_ROLE_KEY` dari **Project Settings → API**.

### 3.4 Setup Email (Resend)

1. Daftar di [resend.com](https://resend.com), verifikasi domain pengirim
   (atau pakai domain testing bawaan Resend untuk demo).
2. Buat API key, isi ke `RESEND_API_KEY`.
3. **Tanpa API key sekalipun prototype tetap berjalan** — `lib/email/send.ts`
   otomatis fallback ke mode mock (email dicetak ke console server), sehingga
   alur activity log & notification log tetap bisa didemokan tanpa akun email.

### 3.5 Environment Variables

```bash
cp .env.example .env.local
# lalu isi semua variabel di .env.local
```

### 3.6 Jalankan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

---

## 4. Alur Demo End-to-End (§12 spesifikasi)

1. Register/login sebagai **Ketua** → buat organisasi "BINUS Student Festival Committee".
2. Tambah anggota (Coordinator, Member) lewat halaman **Members**.
3. Sebagai **Coordinator**, buat project "BINUS Student Festival 2026".
4. Buat task, tetapkan **Member** sebagai PIC → Member menerima email "Kamu ditugaskan".
5. Sebagai **Member**, ubah status task dari `In Progress` → `Done`.
6. Sistem: menyimpan perubahan → membuat activity log → mengambil anggota project
   yang relevan (sesuai preference) → **mengecualikan Member sendiri** → mengirim
   email ke Coordinator & Ketua → mencatat status di `notification_logs`.
7. Ketua membuka **Dashboard project** → melihat progress bertambah dan activity feed ter-update.
8. Buka **Notification Settings → Log Pengiriman Email (Debug)** untuk memverifikasi
   siapa menerima apa, dan statusnya (`sent`/`failed`).

## 5. Aturan Anti-Spam Email (§8) — di mana letaknya di kode

Semua logika ini ada di `actions/task-actions.ts`, fungsi `fetchProjectMembers()`, `pickRecipients()` dan `notifyRecipients()`:

- **Actor tidak pernah menerima email dari aksinya sendiri** → difilter di `pickRecipients()`.
- **Hanya anggota project yang sah** → query dibatasi ke tabel `project_members`, ditegakkan ganda oleh Row Level Security.
- **Preference All / Important only / Off** → `EVENT_IMPORTANCE` map + `isVisibleForLevel()`.
- **Tidak mengirim email untuk perubahan kecil (title/description saja)** → `updateTask()` hanya membuat `changes[]` (dan memicu email) untuk field status, priority, due date, dan assignee.
- **Email tidak dikirim sebelum DB berhasil** → `notifyRecipients()` hanya dipanggil setelah `.update()`/`.insert()` Supabase sukses; jika gagal, fungsi `return` lebih awal.
- **Status pengiriman dicatat** → tabel `notification_logs` (`sent` / `failed` / `pending`).

## 6. Scope Prototype (P0 — sesuai §5 spesifikasi)

Sudah diimplementasikan:
- [x] Login/register (Supabase Auth)
- [x] Create organization/workspace
- [x] Tambah/invite anggota (organisasi & project)
- [x] Create project/event
- [x] Task: PIC, status, priority, deadline
- [x] Project dashboard & progress bar
- [x] Activity/update feed
- [x] Email notification (task assigned, task updated, project announcement)

Sengaja **ditunda ke P1/P2** (§5) — tidak diimplementasikan di prototype ini:
calendar/timeline, budgeting, upload dokumen, QR attendance, advanced analytics,
multi-campus, native app.

## 7. Keamanan (§14)

- Row Level Security aktif di semua tabel (`supabase/migrations/0001_init.sql`).
- Setiap server action memvalidasi ulang akses di server (`lib/permissions/index.ts`) —
  tidak mengandalkan validasi di frontend saja.
- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai di `lib/supabase/admin.ts`
  (ditandai `import 'server-only'`), untuk menulis `activity_logs` dan
  `notification_logs` serta melihat lintas-organisasi saat mencari user by email.
  **Jangan pernah expose service role key ke client.**

## 8. Prototype vs Production (§15)

| Area | Prototype (repo ini) | Production nanti |
|---|---|---|
| Email | Direct API call (Resend) | Queue + retry + rate limit |
| Auth | Email/password | Verifikasi email, reset password, SSO kampus |
| Testing | Manual | Unit + integration + e2e |
| Notifications | Event inti (§8) | Preference center + digest email |

## 9. Catatan Validasi (§18–19)

Dokumen spesifikasi menegaskan: **jangan mengklaim hasil validasi pengguna
sebelum interview/usability testing benar-benar dilakukan.** README ini hanya
mendokumentasikan cara kerja prototype, bukan hasil riset pengguna.
