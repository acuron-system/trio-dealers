import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const SUPPORTED_LOCALES = ["en", "hi", "ta"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const rawLocale = cookieStore.get("trio_locale")?.value;
  const locale: SupportedLocale = SUPPORTED_LOCALES.includes(
    rawLocale as SupportedLocale
  )
    ? (rawLocale as SupportedLocale)
    : "en";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

