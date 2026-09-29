import { emailLayout } from './layout';

interface TaskAssignedEmailProps {
  recipientName: string;
  actorName: string;
  taskTitle: string;
  projectName: string;
  dueDate: string; // sudah diformat, contoh "3 Okt 2026"
  isNewTask: boolean;
  taskUrl: string;
}

/** Dipakai untuk event: task_created (kepada PIC) dan task_assignee_changed (kepada PIC baru). */
export function taskAssignedEmail({
  recipientName,
  actorName,
  taskTitle,
  projectName,
  dueDate,
  isNewTask,
  taskUrl,
}: TaskAssignedEmailProps) {
  const subject = isNewTask
    ? `[${projectName}] Kamu ditugaskan: "${taskTitle}"`
    : `[${projectName}] Kamu jadi PIC baru untuk "${taskTitle}"`;

  const bodyHtml = `
    <p style="margin:0 0 12px;">Hai ${recipientName},</p>
    <p style="margin:0 0 12px;">
      ${
        isNewTask
          ? `<strong>${actorName}</strong> membuat task baru dan menugaskan kamu sebagai PIC:`
          : `<strong>${actorName}</strong> menetapkan kamu sebagai PIC baru untuk task berikut:`
      }
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:16px 0;background:#F5F8FB;border-radius:8px;">
      <tr>
        <td style="padding:14px 16px;">
          <div style="font-size:14px;font-weight:bold;color:#12365E;">${taskTitle}</div>
          <div style="font-size:12px;color:#5B6472;margin-top:4px;">Project: ${projectName} • Deadline: ${dueDate}</div>
        </td>
      </tr>
    </table>
  `;

  const html = emailLayout({
    previewText: `Kamu ditugaskan pada task "${taskTitle}" di ${projectName}`,
    heading: isNewTask ? 'Task Baru untuk Kamu' : 'PIC Baru Ditetapkan',
    bodyHtml,
    ctaLabel: 'Lihat Task',
    ctaUrl: taskUrl,
  });

  return { subject, html };
}
