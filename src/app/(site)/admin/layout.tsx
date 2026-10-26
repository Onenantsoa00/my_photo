import Link from "next/link";
import { redirect } from "next/navigation";

import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { getSessionUser } from "@/server/auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const user = await getSessionUser();

  // Double barrière : le layout protège l'affichage, chaque action serveur
  // revérifie le rôle de son côté.
  if (!user || user.role !== "ADMIN") {
    redirect("/connexion");
  }

  const links = [
    { href: "/admin", label: translate(locale, "admin.title") },
    { href: "/admin/commandes", label: translate(locale, "admin.orders") },
    { href: "/admin/produits", label: translate(locale, "admin.products") },
    { href: "/admin/zones", label: translate(locale, "admin.zones") },
  ];

  return (
    <div className="container-page py-8">
      <nav className="flex flex-wrap gap-2 border-b border-sand-200 pb-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-sand-100"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  );
}
