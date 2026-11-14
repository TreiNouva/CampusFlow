import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DocumentUploader } from '@/components/documents/document-uploader';
import { DocumentList, type DocItem } from '@/components/documents/document-list';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL } from '@/lib/documents';
import { canUploadProjectDocument, isProjectManagerRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { divisionColor, GLOBAL_COLOR } from '@/lib/colors';
import type { DocumentCategory, ProjectRole } from '@/types/database';

export default async function DocumentsPage(
  props: { params: Promise<{ projectId: string }>; searchParams: Promise<{ kategori?: string; kelompok?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const user = await requireUser();
  const supabase = await createClient();
  const pid = params.projectId;

  const [{ data: project }, { data: membership }, { data: docs }, { data: divisions }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', pid).single(),
    supabase.from('project_members').select('role, division_id').eq('project_id', pid).eq('user_id', user.id).maybeSingle(),
    supabase
      .from('documents')
      .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name), task:tasks(title), division:project_divisions(name, color)')
      .eq('project_id', pid)
      .order('created_at', { ascending: false }),
    supabase.from('project_divisions').select('id, name').eq('project_id', pid).order('name'),
  ]);
  if (!project || !membership) notFound();

  const myRole = membership.role as ProjectRole;
  const myDiv = membership.division_id as string | null;
  const filter = DOCUMENT_CATEGORIES.includes(searchParams.kategori as DocumentCategory) ? (searchParams.kategori as DocumentCategory) : null;

  const scopeOptions = [
    ...(canUploadProjectDocument(myRole, myDiv, null) ? [{ id: null as string | null, label: 'Global (semua anggota)' }] : []),
    ...(divisions ?? []).filter((d: any) => canUploadProjectDocument(myRole, myDiv, d.id)).map((d: any) => ({ id: d.id as string, label: `Divisi ${d.name}` })),
  ];
  const canUpload = scopeOptions.length > 0;

  const items: DocItem[] = ((docs ?? []) as any[])
    .filter((d) => !filter || d.category === filter)
    .map((d) => ({
      id: d.id, name: d.name, category: d.category, size_bytes: Number(d.size_bytes), created_at: d.created_at,
      uploaderName: d.uploader?.full_name ?? 'Seseorang', uploadedBy: d.uploaded_by, taskId: d.task_id, taskTitle: d.task?.title ?? null,
      divisionName: d.division?.name ?? null, divisionColor: d.division?.color ?? null,
    }));
  // v8.4: dokumen bisa dikelompokkan per divisi/bidang (masukan pengguna), selain disaring per jenis.
  const byDivision = searchParams.kelompok === 'divisi';
  const groups: { key: string; label: string; color: string | null; docs: DocItem[] }[] = [];
  if (byDivision) {
    const map = new Map<string, { key: string; label: string; color: string | null; docs: DocItem[] }>();
    for (const d of items) {
      const key = d.divisionName ?? '_global';
      if (!map.has(key)) map.set(key, { key, label: d.divisionName ? `Divisi ${d.divisionName}` : 'Global (semua anggota)', color: d.divisionColor, docs: [] });
      map.get(key)!.docs.push(d);
    }
    groups.push(...Array.from(map.values()).sort((a, b) => (a.key === '_global' ? -1 : b.key === '_global' ? 1 : a.label.localeCompare(b.label))));
  }
  const qs = (next: { kategori?: string | null; kelompok?: string | null }) => {
    const p = new URLSearchParams();
    const k = next.kategori === undefined ? filter : next.kategori;
    const g = next.kelompok === undefined ? (byDivision ? 'divisi' : null) : next.kelompok;
    if (k) p.set('kategori', k);
    if (g) p.set('kelompok', g);
    const str = p.toString();
    return `/projects/${pid}/documents${str ? `?${str}` : ''}`;
  };

  const counts = new Map<string, number>();
  for (const d of (docs ?? []) as any[]) counts.set(d.category, (counts.get(d.category) ?? 0) + 1);

  return (
    <div>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="font-heading text-xl font-bold text-ink sm:text-2xl">Dokumen Project</h1>
        <p className="text-sm text-muted">Proposal, LPJ, rundown, notulen, dan berkas lain. Lampiran task juga muncul di sini.</p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted">Kelompokkan</span>
                  <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-semibold" role="group" aria-label="Kelompokkan dokumen">
                    <Link href={qs({ kelompok: null })} className={cn('rounded-md px-3 py-1', !byDivision ? 'bg-surface text-navy shadow-sm' : 'text-muted')}>Semua</Link>
                    <Link href={qs({ kelompok: 'divisi' })} className={cn('rounded-md px-3 py-1', byDivision ? 'bg-surface text-navy shadow-sm' : 'text-muted')}>Per divisi</Link>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Link href={qs({ kategori: null })} className={cn('rounded-full px-3 py-1 text-xs font-semibold', !filter ? 'bg-brand text-white' : 'bg-gray-100 text-muted hover:text-ink')}>
                    Semua jenis ({(docs ?? []).length})
                  </Link>
                  {DOCUMENT_CATEGORIES.filter((c) => counts.get(c)).map((c) => (
                    <Link key={c} href={qs({ kategori: c })} className={cn('rounded-full px-3 py-1 text-xs font-semibold', filter === c ? 'bg-brand text-white' : 'bg-gray-100 text-muted hover:text-ink')}>
                      {DOCUMENT_CATEGORY_LABEL[c]} ({counts.get(c)})
                    </Link>
                  ))}
                </div>
              </CardHeader>
              <CardBody>
                {byDivision ? (
                  groups.length === 0 ? <p className="text-sm text-muted">Belum ada dokumen.</p> : (
                    <div className="space-y-6">
                      {groups.map((g) => (
                        <section key={g.key} aria-label={g.label}>
                          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.key === '_global' ? GLOBAL_COLOR.accent : divisionColor(g.color).accent }} aria-hidden />
                            {g.label} <span className="font-normal text-muted">({g.docs.length})</span>
                          </h3>
                          <DocumentList projectId={pid} docs={g.docs} currentUserId={user.id} canModerate={isProjectManagerRole(myRole)} />
                        </section>
                      ))}
                    </div>
                  )
                ) : (
                  <DocumentList projectId={pid} docs={items} currentUserId={user.id} canModerate={isProjectManagerRole(myRole)} />
                )}
              </CardBody>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader><h2 className="font-heading text-base font-bold text-ink">Unggah Dokumen</h2></CardHeader>
              <CardBody>
                {canUpload ? (
                  <DocumentUploader projectId={pid} scopeOptions={scopeOptions} />
                ) : (
                  <p className="text-sm text-muted">
                    {myRole === 'ketua' ? 'Ketua melihat dokumen sebagai viewer.' : 'Kamu belum masuk divisi. Minta Project Manager menempatkanmu di divisi untuk mengunggah dokumen divisi; lampiran task tetap bisa diunggah dari halaman task.'}
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
