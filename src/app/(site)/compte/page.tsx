import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatMga } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { storageUrl } from "@/lib/storage-url";
import { getSessionUser } from "@/server/auth";
import { listDesignsForUser } from "@/server/designs";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Mon compte",
};

export default async function AccountPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const user = await getSessionUser();
  if (!user) redirect("/connexion");

  const [orders, designs] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { items: true } } },
    }),
    listDesignsForUser(user.id),
  ]);

  return (
    <div className="container-page py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">{t("account.title")}</h1>
          <p className="muted mt-1">
            {t("auth.signedInAs")} <strong>{user.name}</strong>
            {/* Un compte ouvert par WhatsApp n'a pas d'adresse e-mail. */}
            {user.email ? ` · ${user.email}` : user.phone ? ` · ${user.phone}` : null}
          </p>
        </div>
        <Link href="/creer" className="btn-primary">
          🎨 {t("nav.editor")}
        </Link>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-bold">{t("account.orders")}</h2>

        {orders.length === 0 ? (
          <p className="muted mt-3">{t("order.noOrders")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {orders.map((order) => (
              <li key={order.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/commande/${order.reference}`}
                    className="font-mono text-sm font-bold hover:text-brand-700"
                  >
                    {order.reference}
                  </Link>
                  <p className="muted text-xs">
                    {formatDate(order.createdAt, locale === "mg" ? "fr-MG" : "fr-FR")} ·{" "}
                    {order._count.items} {t("admin.items").toLowerCase()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge kind="order" value={order.status} locale={locale} />
                  <StatusBadge kind="payment" value={order.paymentStatus} locale={locale} />
                </div>

                <p className="w-28 text-right font-bold text-brand-700">
                  {formatMga(order.totalMga)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold">{t("account.designs")}</h2>

        {designs.length === 0 ? (
          <p className="muted mt-3">{t("account.noDesigns")}</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {designs.map((design) => {
              const thumbnail = storageUrl(design.thumbnailPath ?? design.previewPath);

              return (
                <article key={design.id} className="card overflow-hidden">
                  <div className="aspect-[4/3] bg-sand-100">
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnail}
                        alt={design.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-2xl">
                        🎨
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="truncate text-sm font-semibold">{design.title}</h3>
                    <p className="muted text-xs">
                      {design.canvasWidth}×{design.canvasHeight} px
                    </p>
                    <Link
                      href={`/editeur?design=${design.id}`}
                      className="btn-outline mt-2 w-full py-1.5 text-xs"
                    >
                      {t("account.openEditor")}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
