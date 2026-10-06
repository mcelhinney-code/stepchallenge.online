import type { AppEnv } from './types';

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  origin: string,
  env: AppEnv['Bindings']
): Promise<boolean> {
  const resetUrl = `${origin}/forgot-password/${encodeURIComponent(token)}`;

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': env.POSTMARK_API_TOKEN,
    },
    body: JSON.stringify({
      From: env.POSTMARK_FROM_EMAIL,
      To: to,
      Subject: 'Reset your Step Challenge password',
      HtmlBody: `<p>Hello,</p>
<p>Click the link below to reset your Step Challenge password. This link expires in 15 minutes and can only be used once.</p>
<p><a href="${resetUrl}">${resetUrl}</a></p>
<p>If you did not request this, you can ignore this email.</p>`,
      MessageStream: 'outbound',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Postmark error ${response.status}:`, body);
    return false;
  }

  return true;
}
