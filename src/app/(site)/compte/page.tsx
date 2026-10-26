import type { Metadata } from "next";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Clock3,
  LayoutDashboard,
  Package,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { countDocumentPages } from "@/lib/editor/types";
import { formatDate, formatMga } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { prisma } from "@/lib/prisma";
import { storageUrl } from "@/lib/storage-url";
import { getSessionUser } from "@/server/auth";
import { listDesignsForUser } from "@/server/designs";
import { listCustomerNotifications } from "@/server/notifications";

export const metadata: Metadata = {
  title: "Mon compte",
};

export default async function AccountPage() {
  const locale = await getLocale();
  const t = (
    key: Parameters<typeof translate>[1],
    replacements?: Record<string, string | number>,
  ) => translate(locale, key, replacements);
  const dateLocale = locale === "mg" ? "fr-MG" : "fr-FR";

  const user = await getSessionUser();
  if (!user) redirect("/connexion");

  const [orders, designs, notifications] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { items: true } } },
    }),
    listDesignsForUser(user.id),
    listCustomerNotifications(user.id, locale),
  ]);

  const drafts = designs.map((design) => ({
    ...design,
    pageCount: countDocumentPages(design.document),
    thumbnail: storageUrl(design.thumbnailPath ?? design.previewPath),
  }));
  const latest = drafts[0] ?? null;

  return (
    <div className="container-page py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-lg font-black text-white shadow-md shadow-brand-700/20">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {t("account.title")}
            </h1>
            <p className="muted mt-0.5 text-sm">
              {t("auth.signedInAs")} <strong>{user.name}</strong>
              {user.email ? ` · ${user.email}` : user.phone ? ` · ${user.phone}` : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {user.role === "ADMIN" ? (
            <Link href="/admin" className="btn-outline text-sm">
              <LayoutDashboard className="h-4 w-4" /> {t("nav.admin")}
            </Link>
          ) : null}
          <Link href="/creer" className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> {t("account.newPhotobook")}
          </Link>
        </div>
      </header>

      {notifications.length > 0 ? (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Bell className="h-5 w-5 text-brand-600" /> {t("notif.title")}
          </h2>

          <ul className="mt-3 space-y-2">
            {notifications.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="card block border-l-4 border-l-brand-500 p-4 transition-colors hover:bg-brand-50/60 dark:hover:bg-brand-900/20"
                >
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="muted mt-1 text-xs leading-relaxed">{item.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {latest ? (
        <section className="mt-8 overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-card to-sand-50 p-5 shadow-sm sm:p-7 dark:border-brand-800 dark:from-brand-900/40 dark:via-card dark:to-sand-100">
          <div className="flex flex-wrap items-center gap-5">
            <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-sand-100 ring-1 ring-sand-300">
              {latest.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={latest.thumbnail}
                  alt={latest.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="grid h-full w-full place-items-center text-3xl">🎨</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                <Clock3 className="h-3 w-3" /> {t("account.continueDraft")}
              </span>
              <h2 className="mt-2 truncate text-xl font-black tracking-tight">
                {latest.title || t("editor.untitled")}
              </h2>
              <p className="muted mt-1 text-xs">
                {t("account.pages", { pages: latest.pageCount })} ·{" "}
                {t("account.updated", { date: formatDate(latest.updatedAt, dateLocale) })}
              </p>
            </div>

            <Link href={`/editeur?design=${latest.id}`} className="btn-primary px-5 py-3 text-sm">
              <BookOpen className="h-4 w-4" /> {t("account.resume")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{t("account.drafts")}</h2>
            <p className="muted mt-0.5 text-xs">{t("account.draftsHint")}</p>
          </div>
          {drafts.length > 0 ? (
            <span className="badge-neutral">
              {drafts.length} {t("account.drafts").toLowerCase()}
            </span>
          ) : null}
        </div>

        {drafts.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center gap-3 p-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
              <BookOpen className="h-6 w-6" />
            </span>
            <p className="muted max-w-sm text-sm">{t("account.noDrafts")}</p>
            <Link href="/creer" className="btn-primary mt-1 text-sm">
              <Plus className="h-4 w-4" /> {t("account.newPhotobook")}
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {drafts.map((design) => (
              <article
                key={design.id}
                className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-sand-100">
                  {design.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={design.thumbnail}
                      alt={design.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-3xl">🎨</span>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-ink-900/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                    {t("account.draftBadge")}
                  </span>
                  <span className="absolute bottom-2 right-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-bold text-ink-700 backdrop-blur">
                    {design.pageCount} {t("editor.pagesShort")}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-3">
                  <h3 className="truncate text-sm font-bold">
                    {design.title || t("editor.untitled")}
                  </h3>
                  <p className="muted mt-0.5 text-[11px]">
                    {t("account.updated", {
                      date: formatDate(design.updatedAt, dateLocale),
                    })}
                  </p>
                  <Link
                    href={`/editeur?design=${design.id}`}
                    className="btn-outline mt-3 w-full gap-1.5 py-1.5 text-xs"
                  >
                    <BookOpen className="h-3.5 w-3.5" /> {t("account.resume")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Package className="h-5 w-5 text-brand-600" /> {t("account.orders")}
        </h2>

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
                    {formatDate(order.createdAt, dateLocale)} · {order._count.items}{" "}
                    {t("admin.items").toLowerCase()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge kind="order" value={order.status} locale={locale} />
                  <StatusBadge kind="payment" value={order.paymentStatus} locale={locale} />
                </div>

                <p className="w-28 text-right font-bold text-brand-700 dark:text-brand-300">
                  {formatMga(order.totalMga)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
