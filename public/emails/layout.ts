/**
 * Wrapper HTML sederhana untuk semua email CampusFlow.
 * Tidak memakai react-email agar dependency tetap ringan untuk prototype —
 * bisa diganti ke @react-email/components kapan saja tanpa mengubah pemanggilnya
 * (lihat lib/email/send.ts) karena yang dikembalikan tetap { subject, html }.
 */

const BRAND_NAVY = '#12365E';
const BRAND_ORANGE = '#FF7A45';

interface EmailLayoutOptions {
  previewText: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export function emailLayout({ previewText, heading, bodyHtml, ctaLabel, ctaUrl }: EmailLayoutOptions): string {
  return `<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F4F7FB;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E3EAF1;">
            <tr>
              <td style="background:${BRAND_NAVY};padding:24px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:bold;font-family:Georgia,serif;">CampusFlow</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:19px;color:#1B1B1F;font-family:Georgia,serif;">${heading}</h1>
                <div style="font-size:14px;line-height:1.6;color:#3A3F47;">${bodyHtml}</div>
                ${
                  ctaLabel && ctaUrl
                    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                        <tr>
                          <td style="border-radius:8px;background:${BRAND_ORANGE};">
                            <a href="${ctaUrl}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;">${ctaLabel}</a>
                          </td>
                        </tr>
                      </table>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#F5F8FB;border-top:1px solid #E3EAF1;">
                <p style="margin:0;font-size:12px;color:#5B6472;">
                  Email ini dikirim karena kamu tergabung dalam sebuah project di CampusFlow.
                  Ubah preferensi notifikasi kapan saja di halaman
                  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}" style="color:${BRAND_NAVY};">Notification Settings</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
