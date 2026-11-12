import { emailLayout } from './layout';

interface TaskUpdatedEmailProps {
  recipientName: string;
  actorName: string;
  taskTitle: string;
  projectName: string;
  changeSummary: string; // contoh: "Status: In Progress → Done"
  taskUrl: string;
}

/** Dipakai untuk event: task_status_changed, task_priority_changed, task_due_date_changed. */
export function taskUpdatedEmail({
  recipientName,
  actorName,
  taskTitle,
  projectName,
  changeSummary,
  taskUrl,
}: TaskUpdatedEmailProps) {
  const subject = `[${projectName}] "${taskTitle}" diperbarui oleh ${actorName}`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hai ${recipientName},</p>
    <p style="margin:0 0 12px;">
      <strong>${actorName}</strong> baru saja memperbarui task
      <strong>"${taskTitle}"</strong> di project <strong>${projectName}</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:16px 0;background:#F5F8FB;border-radius:8px;">
      <tr>
        <td style="padding:14px 16px;font-size:13px;color:#12365E;font-weight:bold;">
          ${changeSummary}
        </td>
      </tr>
    </table>
  `;

  const html = emailLayout({
    previewText: `${actorName} memperbarui "${taskTitle}" — ${changeSummary}`,
    heading: 'Update Task',
    bodyHtml,
    ctaLabel: 'Lihat Task',
    ctaUrl: taskUrl,
  });

  return { subject, html };
}
