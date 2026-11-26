"use client";

import React from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
  { code: "ta", label: "த" },
] as const;

export function LanguageSwitcher() {
  const currentLocale = useLocale();
  const router = useRouter();

  const changeLocale = (nextLocale: string) => {
    if (nextLocale === currentLocale) return;
    document.cookie = `trio_locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-xl bg-surface-subtle border border-edge p-0.5"
      role="group"
      aria-label="Language selector"
    >
      <Globe className="w-3.5 h-3.5 text-gold-400 ml-1.5 mr-0.5 hidden sm:block shrink-0" />
      {LOCALES.map((loc) => (
        <button
          key={loc.code}
          type="button"
          onClick={() => changeLocale(loc.code)}
          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
            currentLocale === loc.code
              ? "bg-gold-500 text-black"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {loc.label}
        </button>
      ))}
    </div>
  );
}

