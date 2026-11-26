export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

const COMMON_WEAK_PASSWORDS = new Set([
  "password123",
  "1234567890",
  "qwerty1234",
  "admin12345",
  "triodealers",
  "welcome123",
  "letmein123",
]);

/**
 * Validates strong password complexity: min 10 chars, upper, lower, digit, and special character.
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  if (!password || password.length < 10) {
    return { valid: false, error: "Password must be at least 10 characters long." };
  }
  if (password.length > 128) {
    return { valid: false, error: "Password must not exceed 128 characters." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must include at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must include at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must include at least one number." };
  }
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return {
      valid: false,
      error: "Password must include at least one special character (e.g. @, #, !, $).",
    };
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, error: "Please choose a stronger, non-common password." };
  }
  return { valid: true };
}

