import { emailLayout } from './layout';

interface ProjectAnnouncementEmailProps {
  recipientName: string;
  actorName: string;
  projectName: string;
  title: string;
  body: string;
  projectUrl: string;
  isUpdate?: boolean;
  scopeLabel?: string;
}

/** Dipakai untuk event: project_announcement — dikirim ke seluruh anggota project. */
export function projectAnnouncementEmail({
  recipientName,
  actorName,
  projectName,
  title,
  body,
  projectUrl,
  isUpdate = false,
  scopeLabel,
}: ProjectAnnouncementEmailProps) {
  const subject = `[${projectName}${scopeLabel ? ' · ' + scopeLabel : ''}] ${isUpdate ? 'Pengumuman diperbarui' : 'Pengumuman'}: ${title}`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hai ${recipientName},</p>
    <p style="margin:0 0 12px;">
      <strong>${actorName}</strong> ${isUpdate ? 'memperbarui pengumuman' : 'membagikan pengumuman baru'} di project <strong>${projectName}</strong>${scopeLabel ? ` (untuk <strong>${scopeLabel}</strong>)` : ''}:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:16px 0;background:#F5F8FB;border-radius:8px;">
      <tr>
        <td style="padding:14px 16px;">
          <div style="font-size:14px;font-weight:bold;color:#12365E;margin-bottom:6px;">${title}</div>
          <div style="font-size:13px;color:#3A3F47;white-space:pre-line;">${body}</div>
        </td>
      </tr>
    </table>
  `;

  const html = emailLayout({
    previewText: `${actorName}: ${title}`,
    heading: isUpdate ? 'Pengumuman Diperbarui' : 'Pengumuman Project',
    bodyHtml,
    ctaLabel: 'Buka Project',
    ctaUrl: projectUrl,
  });

  return { subject, html };
}
