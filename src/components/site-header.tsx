import { SiteHeaderShell, type HeaderLink } from "@/components/site-header-shell";
import { translate, type Locale } from "@/lib/i18n";
import { getSessionUser } from "@/server/auth";
import { getCartItemCount } from "@/server/cart";
import { listCustomerNotifications } from "@/server/notifications";

export async function SiteHeader({ locale }: { locale: Locale }) {
  const [user, cartCount] = await Promise.all([getSessionUser(), getCartItemCount()]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  // Notifications du client : paiement validé (délai annoncé) ou refusé.
  const notifications = user ? await listCustomerNotifications(user.id, locale) : [];

  const links: HeaderLink[] = [
    { href: "/", label: t("nav.home") },
    { href: "/produits", label: t("nav.photobooks") },
    { href: "/suivi", label: t("nav.tracking") },
    { href: "/creer", label: t("nav.editor"), primary: true },
  ];

  return (
    <SiteHeaderShell
      links={links}
      locale={locale}
      cartCount={cartCount}
      notifications={notifications}
      user={user ? { name: user.name, role: user.role as "CUSTOMER" | "ADMIN" } : null}
    />
  );
}
