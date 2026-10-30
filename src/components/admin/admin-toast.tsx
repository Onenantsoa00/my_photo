"use client";

import { CircleCheck } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useT } from "@/components/locale-provider";

/**
 * Confirmation affichée après un enregistrement dans le back-office.
 *
 * Les actions serveur redirigent vers la même page avec `?saved=1` : la
 * notification apparaît, puis le paramètre est retiré de l'URL pour qu'un
 * rechargement (ou un lien partagé) ne la rejoue pas.
 */
export function AdminToast() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const saved = params.get("saved") === "1";
  const [visible, setVisible] = useState(saved);

  // Un enregistrement affiche la notification, même si elle était déjà passée.
  useEffect(() => {
    if (saved) setVisible(true);
  }, [saved]);

  useEffect(() => {
    if (!saved) return;

    const next = new URLSearchParams(window.location.search);
    next.delete("saved");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [saved, pathname, router]);

  // Le minuteur ne dépend que de l'affichage : retirer `saved` de l'adresse
  // annulait auparavant ce nettoyage et la notification restait à l'écran.
  useEffect(() => {
    if (!visible) return;

    const timer = window.setTimeout(() => setVisible(false), 2800);

    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      <p className="flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white shadow-xl shadow-brand-900/30">
        <CircleCheck className="h-4 w-4" />
        {t("admin.savedOk")}
      </p>
    </div>
  );
}
