import 'server-only';
import { Resend } from 'resend';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  success: boolean;
  providerId?: string;
  errorMessage?: string;
}

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM ?? 'CampusFlow <notifications@campusflow.demo>';

const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Mengirim satu email. Jika RESEND_API_KEY belum di-set (mis. saat development
 * lokal tanpa akun Resend), fungsi ini otomatis "mock" — email hanya dicetak
 * ke console, dan tetap mengembalikan success:true supaya alur notification_log
 * di actions/task-actions.ts bisa tetap diuji end-to-end tanpa kena biaya/limit.
 *
 * PENTING (§8 Aturan Email Notification): fungsi ini TIDAK memutuskan siapa
 * yang berhak menerima — filtering penerima & anti-spam dilakukan SEBELUM
 * memanggil fungsi ini (lihat actions/task-actions.ts -> pickRecipients()).
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<SendEmailResult> {
  if (!resendClient) {
    console.info(`[MOCK EMAIL] to=${to} subject="${subject}" (RESEND_API_KEY belum di-set, lihat .env.example)`);
    return { success: true, providerId: `mock-${Date.now()}` };
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: emailFrom,
      to,
      subject,
      html,
    });

    if (error) {
      return { success: false, errorMessage: error.message };
    }

    return { success: true, providerId: data?.id };
  } catch (err) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : 'Unknown email error',
    };
  }
}
