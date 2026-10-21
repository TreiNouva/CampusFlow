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
import type { DocumentCategory, ProjectRole } from '@/types/database';

export default async function DocumentsPage({ params, searchParams }: { params: { projectId: string }; searchParams: { kategori?: string } }) {
  const user = await requireUser();
  const supabase = createClient();
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
              <CardHeader>
                <div className="flex flex-wrap gap-1.5">
                  <Link href={`/projects/${pid}/documents`} className={cn('rounded-full px-3 py-1 text-xs font-semibold', !filter ? 'bg-navy text-white' : 'bg-gray-100 text-muted hover:text-ink')}>
                    Semua ({(docs ?? []).length})
                  </Link>
                  {DOCUMENT_CATEGORIES.filter((c) => counts.get(c)).map((c) => (
                    <Link key={c} href={`/projects/${pid}/documents?kategori=${c}`} className={cn('rounded-full px-3 py-1 text-xs font-semibold', filter === c ? 'bg-navy text-white' : 'bg-gray-100 text-muted hover:text-ink')}>
                      {DOCUMENT_CATEGORY_LABEL[c]} ({counts.get(c)})
                    </Link>
                  ))}
                </div>
              </CardHeader>
              <CardBody>
                <DocumentList projectId={pid} docs={items} currentUserId={user.id} canModerate={isProjectManagerRole(myRole)} />
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
