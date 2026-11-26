export interface EmailDispatchOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Dispatches transactional emails via Resend REST API when RESEND_API_KEY is configured.
 * Gracefully degrades without throwing in unconfigured local environments.
 */
export async function sendTransactionalEmail(
  opts: EmailDispatchOptions
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, skipped: true };
  }

  const from =
    process.env.EMAIL_FROM || "Trio Dealers <orders@triodealers.in>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      return {
        sent: false,
        error:
          (payload as { message?: string })?.message ||
          `Email dispatch failed (${response.status})`,
      };
    }

    return { sent: true };
  } catch (err: any) {
    return { sent: false, error: err?.message || "Email dispatch failed" };
  }
}
