import Link from "next/link";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { translate, type Locale } from "@/lib/i18n";
import { getSessionUser } from "@/server/auth";
import { getCartItemCount } from "@/server/cart";
import { signOutAction } from "@/server/actions/auth";

export async function SiteHeader({ locale }: { locale: Locale }) {
  const [user, cartCount] = await Promise.all([getSessionUser(), getCartItemCount()]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/produits", label: t("nav.products") },
    // L'entrée de création passe par l'assistant : format, orientation,
    // couverture et point de départ avant d'ouvrir l'atelier.
    { href: "/creer", label: t("nav.editor") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-lg font-black text-white">
            M
          </span>
          <span className="hidden text-base font-bold tracking-tight sm:block">
            MyPhoto<span className="text-brand-600">Mada</span>
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm font-medium">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-ink-700 hover:bg-sand-100"
            >
              {link.label}
            </Link>
          ))}
          {user?.role === "ADMIN" ? (
            <Link
              href="/admin"
              className="whitespace-nowrap rounded-lg px-3 py-2 text-brand-700 hover:bg-brand-50"
            >
              {t("nav.admin")}
            </Link>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher locale={locale} />

          <Link
            href="/panier"
            className="relative rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-sand-100"
          >
            {t("nav.cart")}
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            ) : null}
          </Link>

          {user ? (
            <div className="flex items-center gap-1">
              <Link
                href="/compte"
                className="hidden rounded-lg px-2 py-2 text-sm font-semibold text-ink-700 hover:bg-sand-100 sm:block"
              >
                {user.name.split(" ")[0]}
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-lg px-2 py-2 text-sm font-medium text-ink-500 hover:bg-sand-100"
                >
                  {t("nav.signOut")}
                </button>
              </form>
            </div>
          ) : (
            <Link href="/connexion" className="btn-primary btn-sm whitespace-nowrap">
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
