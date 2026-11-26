"use client";

import React from "react";
import { useTheme } from "@/context/theme-context";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-edge bg-surface-subtle hover:border-gold-500/60 text-ink transition-all duration-200 ${
        compact ? "p-2" : "px-2.5 py-2 text-[11px] font-semibold"
      }`}
    >
      {isDark ? (
        <>
          <Sun className="w-4 h-4 text-gold-400" />
          {!compact && <span className="hidden xl:inline text-ink-secondary">Light</span>}
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-gold-600" />
          {!compact && <span className="hidden xl:inline text-ink-secondary">Dark</span>}
        </>
      )}
    </button>
  );
}

