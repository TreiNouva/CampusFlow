import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
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

/**
 * Tiga cara kirim, dipilih otomatis dari env (urutan prioritas):
 *  1. SMTP  — SMTP_HOST + SMTP_USER + SMTP_PASS terisi. Dipakai CampusFlow karena tidak punya domain
 *            sendiri: akun Gmail tim + App Password (smtp.gmail.com:465). Bisa mengirim ke email siapa
 *            saja, batas ±500 email/hari untuk akun Gmail biasa.
 *  2. Resend — RESEND_API_KEY terisi. Butuh domain terverifikasi agar bisa mengirim ke selain pemilik akun.
 *  3. Mock  — tidak ada keduanya: email hanya dicetak ke console (development lokal).
 *
 * PENTING (§8 Aturan Email Notification): fungsi ini TIDAK memutuskan siapa
 * yang berhak menerima — filtering penerima & anti-spam dilakukan SEBELUM
 * memanggil fungsi ini (lihat actions/task-actions.ts -> pickRecipients()).
 */
const smtpHost = process.env.SMTP_HOST;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, ''); // App Password Gmail sering disalin dengan spasi
const smtpPort = Number(process.env.SMTP_PORT ?? 465);
const resendApiKey = process.env.RESEND_API_KEY;

// Dengan SMTP Gmail, alamat pengirim harus alamat Gmail itu sendiri (Gmail menolak/mengganti alamat lain).
const emailFrom =
  process.env.EMAIL_FROM ?? (smtpUser ? `CampusFlow <${smtpUser}>` : 'CampusFlow <notifications@campusflow.demo>');

let smtpTransport: Transporter | null = null;
function getSmtp(): Transporter | null {
  if (!smtpHost || !smtpUser || !smtpPass) return null;
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }
  return smtpTransport;
}

const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

/** Teks polos dari HTML, sebagai cadangan untuk aplikasi email yang tidak menampilkan HTML (mengurangi skor spam). */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<SendEmailResult> {
  const smtp = getSmtp();

  if (smtp) {
    try {
      const info = await smtp.sendMail({ from: emailFrom, to, subject, html, text: htmlToText(html) });
      return { success: true, providerId: info.messageId };
    } catch (err) {
      return { success: false, errorMessage: err instanceof Error ? err.message : 'SMTP error' };
    }
  }

  if (resendClient) {
    try {
      const { data, error } = await resendClient.emails.send({ from: emailFrom, to, subject, html });
      if (error) return { success: false, errorMessage: error.message };
      return { success: true, providerId: data?.id };
    } catch (err) {
      return { success: false, errorMessage: err instanceof Error ? err.message : 'Unknown email error' };
    }
  }

  console.info(`[MOCK EMAIL] to=${to} subject="${subject}" (SMTP_* / RESEND_API_KEY belum di-set, lihat .env.example)`);
  return { success: true, providerId: `mock-${Date.now()}` };
}
