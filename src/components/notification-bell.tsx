"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useT } from "@/components/locale-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NotificationItem = {
  id: string;
  href: string;
  title: string;
  body: string;
};

const STORAGE_KEY = "mp_read_notifications";

function loadReadIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Cloche de notifications de l'en-tête.
 *
 * L'état « lu » reste dans le navigateur : le serveur fournit la liste, le
 * client compte ce qui n'a pas encore été ouvert et l'annonce à l'ouverture
 * du menu. Sans JavaScript, la cloche reste un lien vers la page de compte.
 */
export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const t = useT();
  const router = useRouter();
  const [readIds, setReadIds] = useState<string[] | null>(null);

  // Calculé après le montage : la valeur serveur et la valeur client doivent
  // coïncider au premier rendu pour ne pas diverger à l'hydratation.
  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  if (items.length === 0) return null;

  const unread = readIds ? items.filter((item) => !readIds.includes(item.id)).length : 0;

  const markAllRead = () => {
    const known = loadReadIds();
    const next = Array.from(new Set([...known, ...items.map((item) => item.id)]));

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-200)));
    } catch {
      // Stockage indisponible : la cloche reste juste moins "intelligente".
    }
    setReadIds(next);
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) markAllRead();
      }}
    >
      <DropdownMenuTrigger
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-sand-300 bg-card text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700"
        aria-label={t("notif.title")}
        title={t("notif.title")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white ring-2 ring-card">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 rounded-xl p-1">
        <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wide">
          {t("notif.title")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.href)}
              className="w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-sand-100"
            >
              <span className="block text-xs font-bold text-ink-900">{item.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
                {item.body}
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
