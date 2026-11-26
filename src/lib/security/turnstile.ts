export interface TurnstileVerificationResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Verifies a Cloudflare Turnstile response token server-side.
 * If TURNSTILE_SECRET_KEY is not configured in local dev/test, skips verification gracefully.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string
): Promise<TurnstileVerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !secret.trim()) {
    return { success: true, skipped: true };
  }

  if (!token || !token.trim()) {
    return {
      success: false,
      error: "Human verification challenge token is required.",
    };
  }

  try {
    const body = new URLSearchParams();
    body.append("secret", secret.trim());
    body.append("response", token.trim());
    if (remoteIp) {
      body.append("remoteip", remoteIp);
    }

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }
    );

    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (!data.success) {
      return {
        success: false,
        error: "Verification check failed. Please retry.",
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: "Verification service unreachable. Please try again.",
    };
  }
}

