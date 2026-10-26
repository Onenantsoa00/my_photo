"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";

import { useT } from "@/components/locale-provider";
import { useTheme, type Theme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS: { value: Theme; icon: typeof Sun; key: "theme.light" | "theme.dark" | "theme.system" }[] = [
  { value: "light", icon: Sun, key: "theme.light" },
  { value: "dark", icon: Moon, key: "theme.dark" },
  { value: "system", icon: Monitor, key: "theme.system" },
];

export function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useT();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const TriggerIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`grid h-9 w-9 place-items-center rounded-xl border border-sand-300 bg-card text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700 ${className}`}
        aria-label={t("theme.label")}
        title={t("theme.label")}
      >
        <TriggerIcon className="h-4 w-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44 rounded-xl p-1">
        <DropdownMenuLabel>{t("theme.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(({ value, icon: Icon, key }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="cursor-pointer gap-2 rounded-lg px-2 py-2"
          >
            <Icon className="h-4 w-4 text-ink-500" />
            <span className="flex-1">{t(key)}</span>
            {theme === value ? <Check className="h-3.5 w-3.5 text-brand-600" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
