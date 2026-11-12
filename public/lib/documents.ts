import type { DocumentCategory } from '@/types/database';

export const DOCUMENT_BUCKET = 'project-documents';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'zip'];
export const ACCEPT_ATTRIBUTE = ALLOWED_DOCUMENT_EXTENSIONS.map((e) => '.' + e).join(',');

export const DOCUMENT_CATEGORIES: DocumentCategory[] = ['proposal', 'lpj', 'rundown', 'notulen', 'desain', 'surat', 'lainnya'];
export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  proposal: 'Proposal',
  lpj: 'LPJ',
  rundown: 'Rundown',
  notulen: 'Notulen',
  desain: 'Desain',
  surat: 'Surat',
  lainnya: 'Lainnya',
};

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function fileIcon(name: string): string {
  const e = extensionOf(name);
  if (e === 'pdf') return '📕';
  if (['doc', 'docx'].includes(e)) return '📘';
  if (['xls', 'xlsx', 'csv'].includes(e)) return '📗';
  if (['ppt', 'pptx'].includes(e)) return '📙';
  if (['png', 'jpg', 'jpeg'].includes(e)) return '🖼️';
  if (e === 'zip') return '🗜️';
  return '📄';
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'file';
}
