const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "hr",
  "a",
  "code",
  "pre",
]);

const STRIP_WITH_CONTENT_RE =
  /<(script|style|iframe|object|embed|svg|math|form|input|button|textarea|select|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi;

const VOID_UNSAFE_RE =
  /<(script|style|iframe|object|embed|svg|meta|link|base)\b[^>]*\/?>/gi;

/**
 * Escapes HTML special characters for plain-text rendering contexts.
 */
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Allowlist HTML sanitizer for CMS pages, FAQ answers, and product descriptions.
 * Strips executable elements, event attributes, and non-HTTP(S) URI schemes.
 */
export function sanitizeRichText(rawHtml: string): string {
  if (!rawHtml) return "";

  let cleaned = String(rawHtml)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(STRIP_WITH_CONTENT_RE, "")
    .replace(VOID_UNSAFE_RE, "");

  cleaned = cleaned.replace(
    /<(\/?)([a-zA-Z0-9-]+)([^>]*)>/g,
    (_full, slash: string, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        return "";
      }

      if (slash === "/") {
        return `</${tag}>`;
      }

      if (tag === "br" || tag === "hr") {
        return `<${tag} />`;
      }

      if (tag === "a") {
        const hrefMatch = attrs.match(
          /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i
        );
        const rawHref = (
          hrefMatch?.[1] ||
          hrefMatch?.[2] ||
          hrefMatch?.[3] ||
          ""
        ).trim();

        const isSafeHref =
          rawHref.startsWith("https://") ||
          rawHref.startsWith("http://") ||
          rawHref.startsWith("/") ||
          rawHref.startsWith("mailto:");

        if (!isSafeHref) {
          return "<a>";
        }

        const safeHref = escapeHtml(rawHref);
        if (rawHref.startsWith("http")) {
          return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">`;
        }
        return `<a href="${safeHref}">`;
      }

      return `<${tag}>`;
    }
  );

  return cleaned.trim();
}

