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
│  ├─ migrations/0001_init.sql   # Skema awal
│  ├─ migrations/0002_roles_invites_announcements.sql  # Role baru, divisi, undangan, pengumuman + RLS
│  ├─ migrations/0003_division_scope_calendar_budget_documents.sql  # Cakupan divisi, kalender, dokumen, budget
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
2. Buka **SQL Editor** (New query), jalankan isi `supabase/migrations/0001_init.sql`, lalu **query baru** berisi
   `supabase/migrations/0002_roles_invites_announcements.sql` (urutan wajib; 0002 menulis ulang semua aturan akses).
   Database yang sudah berjalan cukup menjalankan 0002 saja (data lama dikonversi otomatis, lihat §11).
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
2. Undang anggota lewat link undangan atau email (halaman **Anggota & Undangan**).
3. Sebagai anggota organisasi, buat project "BINUS Student Festival 2026" (kamu menjadi Project Manager; Ketua otomatis ikut sebagai viewer).
4. Buat task, tetapkan **Member** sebagai PIC → Member menerima email "Kamu ditugaskan".
5. Sebagai **Member**, ubah status task dari `In Progress` → `Done`.
6. Sistem: menyimpan perubahan → membuat activity log → mengambil anggota project
   yang relevan (sesuai preference) → **mengecualikan Member sendiri** → mengirim
   email ke Project Manager & Ketua → mencatat status di `notification_logs`.
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


## 10. Lupa Password (Forgot / Reset Password)

Alur: **Login → "Lupa password?" → isi email → link dikirim lewat email → klik link →
`/auth/callback` memverifikasi → `/reset-password` (isi password baru) → Dashboard.**

Kode terkait: `components/auth/auth-page.tsx` (form lupa password), `app/auth/callback/route.ts`,
`app/reset-password/page.tsx`, `components/auth/reset-password-view.tsx`, `actions/auth-actions.ts` (`updatePassword`).

Tidak ada perubahan SQL dan tidak ada environment variable baru di Vercel. Yang perlu diatur
ada di **dashboard Supabase** (email dikirim oleh Supabase Auth, bukan oleh kode kita):

### 10.1 URL Configuration (WAJIB)
Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://NAMA-PROJECT.vercel.app` (domain Vercel kamu)
- **Redirect URLs**, tambahkan:
  - `https://NAMA-PROJECT.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (untuk development lokal)

Tanpa ini, link di email mengarah ke alamat yang salah / ditolak Supabase.

### 10.2 Custom SMTP (WAJIB agar bisa dipakai user lain)
Email bawaan Supabase hanya untuk testing: dibatasi sangat kecil (sekitar 2-4 email/jam) dan hanya bisa
mengirim ke anggota tim project Supabase. Untuk user biasa, pasang SMTP sendiri, mis. Resend
(Supabase → **Authentication → Emails → SMTP Settings → Enable Custom SMTP**):

| Field | Nilai |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | API key Resend |
| Sender email | alamat di domain yang sudah diverifikasi di Resend |

Catatan: Resend umumnya mengharuskan domain yang sudah diverifikasi untuk mengirim ke alamat email orang lain.
Pengaturan SMTP ini juga memperbaiki masalah "email rate limit" saat register dengan konfirmasi email.

### 10.3 Template email (OPSIONAL, agar link bisa dibuka di perangkat lain)
Secara default link harus dibuka di **browser yang sama** dengan tempat meminta reset (alur PKCE).
Agar bisa dibuka di HP/perangkat lain, ubah template **Authentication → Email Templates → Reset Password**
dengan link berikut (route `/auth/callback` sudah mendukungnya):

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Atur ulang password</a>
```

### 10.4 Keamanan
- Respons "email terkirim" selalu sama baik email terdaftar maupun tidak (tidak membocorkan daftar akun).
- `/auth/callback` hanya mengizinkan tujuan `/reset-password` dan `/dashboard` (mencegah open redirect).
- Supabase membatasi permintaan reset berulang; UI menampilkan hitung mundur 60 detik untuk "Kirim ulang".


## 11. Peran, Undangan, Divisi & Pengumuman (migrasi 0002)

**Jalankan `0002_roles_invites_announcements.sql` di Supabase SQL Editor SEBELUM men-deploy kode ini**
(kode memanggil fungsi database yang dibuat oleh 0002). Skrip berjalan dalam satu transaksi: jika gagal, tidak ada yang berubah.
Jangan dijalankan dua kali.

### 11.1 Peran organisasi
| Peran | Jumlah | Hak |
|---|---|---|
| Ketua | Satu | Mengatur semua anggota & jabatan, mengeluarkan anggota, mengalihkan jabatan Ketua, otomatis menjadi **viewer** di semua project |
| Wakil Ketua | Satu | Seperti Ketua kecuali menunjuk/mengubah Wakil Ketua dan mengalihkan Ketua |
| Koordinator | Banyak | Membuat link undangan organisasi |
| Sekretaris, Bendahara, Member | Banyak | Anggota biasa |

### 11.2 Peran project
Ketua (viewer), Project Manager (satu), Wakil Project Manager (satu), PIC, Koordinator, Bendahara, Sekretaris, Member.
- **Ketua organisasi** otomatis menjadi anggota semua project dengan peran *Ketua* (hanya melihat; tidak mengubah task/pengumuman),
  tetapi boleh mengatur keanggotaan (ubah peran, kick).
- **Project Manager / Wakil PM**: mengatur anggota, divisi, mengedit/menghapus semua pengumuman. Hanya PM (atau Ketua/Wakil Ketua organisasi)
  yang boleh menunjuk PM/Wakil PM; pemegang lama otomatis menjadi Member.
- **Divisi** dibuat oleh PM/Wakil PM. PIC, Koordinator, dan Member yang masuk divisi mendapat title, mis. *Koordinator Acara*.
- **Membuat pengumuman**: PM, Wakil PM, PIC, Koordinator, Sekretaris. **Mengubah task**: semua anggota kecuali Ketua.
- **Link undangan project**: PM, Wakil PM, PIC, Koordinator (dan Ketua/Wakil Ketua organisasi).

Aturan ini ditegakkan di database (fungsi SQL + RLS), dan dicerminkan di `lib/roles.ts` untuk tampilan. Untuk mengubah siapa boleh melakukan apa,
ubah keduanya (SQL lewat migrasi baru).

### 11.3 Undangan & gabung
- Link `/join/<token>`: token acak panjang, berlaku 1–30 hari, opsional batas pemakaian, bisa dicabut.
- Belum login → diarahkan ke Masuk/Daftar lalu kembali ke link. Link project otomatis memasukkan user ke organisasi (Member) bila belum.
- Anggota organisasi juga bisa bergabung langsung ke project dari halaman organisasi (tombol *Gabung Project*).
- Ketua / Wakil Ketua organisasi / PM / Wakil PM dapat mengeluarkan (kick) anggota. Task milik anggota yang dikeluarkan menjadi belum ditugaskan.

### 11.4 Konversi data lama
| Sebelumnya | Menjadi |
|---|---|
| Organisasi: admin pertama (pembuat) | Ketua |
| Organisasi: admin lain, coordinator | Koordinator |
| Organisasi: member, viewer | Member |
| Project: coordinator pertama (pembuat) | Project Manager (project tanpa coordinator: pembuat/anggota tertua) |
| Project: coordinator lain | Koordinator |
| Project: member, viewer | Member |
Ketua organisasi yang sudah menjadi anggota project berperan non-PM diubah menjadi *Ketua* (viewer). Jika Ketua kebetulan Project Manager project lama,
perannya dipertahankan agar project tidak kehilangan manager; tunjuk PM baru agar Ketua menjadi viewer.

### 11.5 Pengumuman
Disimpan di tabel `announcements` sehingga tampil untuk semua anggota project (termasuk pembuatnya), bisa diedit/dihapus
oleh pembuat atau PM/Wakil PM, dan dikirim lewat email (tidak ke pembuatnya sendiri). Saat edit, email ulang hanya jika dicentang.

## 12. Versi 6: Cakupan Divisi, Kalender, Dokumen, Budget (migrasi 0003)

**Urutan deploy:** (1) jalankan `supabase/migrations/0003_division_scope_calendar_budget_documents.sql` di Supabase SQL Editor
(New query, tempel seluruh isi, Run; sesudah 0001 & 0002; jangan dua kali), (2) baru push kode ke GitHub/Vercel.

- **Ketua boleh jadi Project Manager**: saat membuat project, atau lewat tombol "Jadikan Project Manager" di Anggota & Divisi.
  Bila PM baru ditunjuk, Ketua otomatis kembali menjadi viewer.
- **Member hanya untuk divisinya**: buat/ubah task, lampiran, dan penugasan dibatasi di UI, server action, **dan database (RLS)**.
  Member melihat task, jadwal, pengumuman, dokumen divisinya + Global. Ketua, PM, Wakil PM, Sekretaris melihat semua; PIC/Koordinator/Bendahara: Global + divisinya.
  PIC/Koordinator membuat pengumuman/acara hanya untuk divisinya; Global oleh PM/Wakil PM/Sekretaris.
- **Kalender project** (Ringkasan): tampilan minggu & bulan, mini kalender, filter per divisi, warna tiap divisi (diatur PM di Anggota & Divisi), acara, milestone, kehadiran + check-in.
- **Dokumen**: unggah langsung ke Supabase Storage (bucket privat `project-documents` dibuat otomatis oleh server, perlu `SUPABASE_SERVICE_ROLE_KEY` di Vercel). Lampiran task + halaman Dokumen. Maks 10 MB.
- **Budget** (Ketua, PM, Wakil PM, Bendahara melihat; PM/Wakil PM/Bendahara mengubah): rencana vs realisasi + transaksi.
- **Reset password masih ke localhost?** Itu pengaturan Supabase, bukan Vercel: Authentication → URL Configuration → *Site URL* = domain Vercel kamu,
  dan *Redirect URLs* tambahkan `https://DOMAIN-KAMU/auth/callback` (lihat §10.1). Lalu minta link reset yang BARU.

## 13. Versi 7: Periode Project, Halaman Depan, Tutorial, Navigasi Baru (migrasi 0004)

**Jalankan `supabase/migrations/0004_project_period_onboarding.sql` di SQL Editor Supabase sebelum deploy.**

- **Periode project ditegakkan.** Deadline/tanggal mulai task, milestone, dan acara tidak boleh sebelum
  tanggal mulai atau setelah tanggal selesai project. Dicek di form (input tanggal dibatasi), di server action,
  dan di database (trigger). Task lama yang terlanjur di luar periode tetap bisa diubah statusnya; yang dicek
  hanya tanggal yang diubah. Kalender memberi arsir pada hari di luar periode.
- **Halaman depan (`/`)** menjelaskan isi aplikasi sebelum login: menu yang akan ditemui, cara mulai, peran, paket, FAQ.
- **Tutorial singkat setelah login** (7 langkah, bisa dilewati). Status tersimpan di `profiles.onboarded_at`;
  bisa dibuka lagi dari menu → *Panduan singkat*.
- **Navigasi baru ala m-banking.** Laptop: menu samping. HP: tombol ☰ + bar navigasi bawah (Ringkasan, Task,
  Kalender, Dokumen, Lainnya) dan grid menu cepat di Ringkasan.
- **Halaman project dipecah** supaya tidak penuh: Ringkasan, Kalender (`/calendar`), Pengumuman (`/announcements`),
  Statistik (`/stats`), ditambah Task, Dokumen, Budget, Anggota, Notifikasi.
- **Palet warna lebih tenang:** navy sebagai warna utama, amber hanya untuk peringatan, merah hanya untuk
  telat/error, warna divisi dibuat redup, ikon emoji diganti ikon garis satu warna.
- **Rencana paket** ada di `lib/plans.ts` (draf, angka bisa diubah di satu tempat): Gratis, Organisasi
  (kuota dasar + tambahan per 10 anggota), Kampus.
