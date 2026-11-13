'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  changePassword, deleteOrganization, deleteProject, leaveOrganization, updateOrganization, updateProfileName, updateProject,
  type ManageResult,
} from '@/actions/manage-actions';
import { Input, Label, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function useSubmit(action: (fd: FormData) => Promise<ManageResult>, { reset = false } = {}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setMsg(null);
    start(async () => {
      const res = await action(fd);
      if (!res.success) { setMsg({ ok: false, text: res.error }); return; }
      setMsg({ ok: true, text: 'Tersimpan.' });
      if (reset) form.reset();
      router.refresh();
    });
  }
  return { pending, msg, onSubmit };
}

function Status({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p role={msg.ok ? 'status' : 'alert'} className={cn('text-sm', msg.ok ? 'text-emerald-700' : 'text-red-700')}>{msg.text}</p>;
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50">
      {pending ? 'Menyimpan…' : children}
    </button>
  );
}

export function Panel({ title, description, children, danger }: { title: string; description?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={cn('rounded-card border bg-white p-5', danger ? 'border-red-200' : 'border-line')}>
      <h2 className={cn('font-heading text-lg font-bold', danger ? 'text-red-700' : 'text-ink')}>{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ---------------- Project ---------------- */

export function ProjectInfoForm({ project }: { project: { id: string; name: string; description: string | null; start_date: string | null; end_date: string | null } }) {
  const { pending, msg, onSubmit } = useSubmit(updateProject);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="projectId" value={project.id} />
      <div>
        <Label htmlFor="p-name">Nama project</Label>
        <Input id="p-name" name="name" required minLength={3} maxLength={120} defaultValue={project.name} />
      </div>
      <div>
        <Label htmlFor="p-desc">Deskripsi</Label>
        <Textarea id="p-desc" name="description" rows={3} maxLength={2000} defaultValue={project.description ?? ''} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="p-start">Tanggal mulai</Label>
          <Input id="p-start" name="startDate" type="date" defaultValue={project.start_date ?? ''} />
        </div>
        <div>
          <Label htmlFor="p-end">Tanggal selesai</Label>
          <Input id="p-end" name="endDate" type="date" defaultValue={project.end_date ?? ''} />
        </div>
      </div>
      <p className="text-xs text-muted">Periode tidak bisa dipersempit jika masih ada task, acara, atau milestone di luar periode baru.</p>
      <div className="flex items-center gap-3"><SubmitButton pending={pending}>Simpan perubahan</SubmitButton><Status msg={msg} /></div>
    </form>
  );
}

export function DeleteByNameForm({ kind, name, onDelete }: { kind: 'project' | 'organisasi'; name: string; onDelete: (typed: string) => Promise<ManageResult> }) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const match = typed.trim() === name;
  return (
    <div className="space-y-3">
      <Label htmlFor={`del-${kind}`}>Ketik <b className="font-semibold text-ink">{name}</b> untuk konfirmasi</Label>
      <Input id={`del-${kind}`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button type="button" disabled={!match || pending}
        onClick={() => { setError(null); start(async () => { const r = await onDelete(typed.trim()); if (r && !r.success) setError(r.error); }); }}
        className="rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
        {pending ? 'Menghapus…' : `Hapus ${kind} ini selamanya`}
      </button>
    </div>
  );
}

export function DeleteProjectForm({ projectId, organizationId, name }: { projectId: string; organizationId: string; name: string }) {
  return <DeleteByNameForm kind="project" name={name} onDelete={(t) => deleteProject(projectId, t, organizationId)} />;
}

/* ---------------- Organisasi ---------------- */

export function OrganizationInfoForm({ org }: { org: { id: string; name: string; description: string | null } }) {
  const { pending, msg, onSubmit } = useSubmit(updateOrganization);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="organizationId" value={org.id} />
      <div>
        <Label htmlFor="o-name">Nama organisasi</Label>
        <Input id="o-name" name="name" required minLength={3} maxLength={120} defaultValue={org.name} />
      </div>
      <div>
        <Label htmlFor="o-desc">Deskripsi</Label>
        <Textarea id="o-desc" name="description" rows={3} maxLength={1000} defaultValue={org.description ?? ''} />
      </div>
      <div className="flex items-center gap-3"><SubmitButton pending={pending}>Simpan perubahan</SubmitButton><Status msg={msg} /></div>
    </form>
  );
}

export function DeleteOrganizationForm({ organizationId, name }: { organizationId: string; name: string }) {
  return <DeleteByNameForm kind="organisasi" name={name} onDelete={(t) => deleteOrganization(organizationId, t)} />;
}

export function LeaveOrganizationButton({ organizationId, name }: { organizationId: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-2">
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
          Keluar dari organisasi
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">Yakin keluar dari <b>{name}</b>?</span>
          <button type="button" disabled={pending} onClick={() => start(async () => { const r = await leaveOrganization(organizationId); if (r && !r.success) setError(r.error); })}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {pending ? 'Memproses…' : 'Ya, keluar'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-gray-50">Batal</button>
        </div>
      )}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}

/* ---------------- Akun ---------------- */

export function ProfileNameForm({ fullName }: { fullName: string }) {
  const { pending, msg, onSubmit } = useSubmit(updateProfileName);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="a-name">Nama lengkap</Label>
        <Input id="a-name" name="fullName" required minLength={2} maxLength={80} defaultValue={fullName} autoComplete="name" />
      </div>
      <div className="flex items-center gap-3"><SubmitButton pending={pending}>Simpan nama</SubmitButton><Status msg={msg} /></div>
    </form>
  );
}

export function ChangePasswordForm() {
  const { pending, msg, onSubmit } = useSubmit(changePassword, { reset: true });
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="a-cur">Password saat ini</Label>
        <Input id="a-cur" name="currentPassword" type="password" required autoComplete="current-password" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="a-new">Password baru</Label>
          <Input id="a-new" name="newPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
        </div>
        <div>
          <Label htmlFor="a-conf">Ulangi password baru</Label>
          <Input id="a-conf" name="confirmPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
        </div>
      </div>
      <div className="flex items-center gap-3"><SubmitButton pending={pending}>Ganti password</SubmitButton><Status msg={msg} /></div>
    </form>
  );
}
