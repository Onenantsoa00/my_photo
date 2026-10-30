import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import type { Prisma } from "@/generated/prisma/client";
import { formatDateTime, formatMga } from "@/lib/format";
import { translate, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { PAYMENT_METHOD_LABEL_KEY, type PaymentMethodValue } from "@/lib/payment";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Commandes",
};

const FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "AWAITING_VERIFICATION", label: "Paiements à vérifier" },
  { value: "PENDING", label: "En attente" },
  { value: "IN_PRODUCTION", label: "En production" },
  { value: "SHIPPED", label: "Expédiées" },
  { value: "DELIVERED", label: "Livrées" },
  { value: "CANCELLED", label: "Annulées" },
] as const;

/** Tris proposés, du plus utile au plus rare. */
const SORTS: {
  value: string;
  key: TranslationKey;
  orderBy: Prisma.OrderOrderByWithRelationInput;
}[] = [
  { value: "recent", key: "admin.sortRecent", orderBy: { createdAt: "desc" } },
  { value: "oldest", key: "admin.sortOldest", orderBy: { createdAt: "asc" } },
  { value: "total-desc", key: "admin.sortTotalDesc", orderBy: { totalMga: "desc" } },
  { value: "total-asc", key: "admin.sortTotalAsc", orderBy: { totalMga: "asc" } },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string; q?: string; tri?: string }>;
}) {
  const { filtre, q, tri } = await searchParams;
  const locale = await getLocale();
  const t = (key: TranslationKey, replacements?: Record<string, string | number>) =>
    translate(locale, key, replacements);

  const active = FILTERS.some((filter) => filter.value === filtre) ? filtre : "all";
  const search = (q ?? "").trim();
  const sort = SORTS.find((option) => option.value === tri) ?? SORTS[0];

  // Recherche libre : client, référence, téléphone, e-mail ou zone de
  // livraison. Les valeurs viennent d'un formulaire GET, jamais du HTML brut.
  const where: Prisma.OrderWhereInput = {
    ...(active === "all"
      ? {}
      : active === "AWAITING_VERIFICATION"
        ? { paymentStatus: "AWAITING_VERIFICATION" }
        : { status: active as "PENDING" }),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: "insensitive" } },
            { customerName: { contains: search, mode: "insensitive" } },
            { customerPhone: { contains: search } },
            { customerEmail: { contains: search, mode: "insensitive" } },
            { deliveryZoneLabel: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
            { region: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: sort.orderBy,
    take: 100,
    include: { _count: { select: { items: true } } },
  });

  const filterHref = (value: string) => {
    const params = new URLSearchParams();
    if (value !== "all") params.set("filtre", value);
    if (search) params.set("q", search);
    if (sort.value !== "recent") params.set("tri", sort.value);

    const query = params.toString();
    return query ? `/admin/commandes?${query}` : "/admin/commandes";
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="section-title">{t("admin.orders")}</h1>
        <span className="badge-neutral">
          {t("admin.searchResults", { count: orders.length })}
        </span>
      </div>

      <nav className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filterHref(filter.value)}
            className={
              active === filter.value
                ? "badge-brand"
                : "badge-neutral hover:bg-brand-50 hover:text-brand-800"
            }
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {/* Recherche (client, référence, livraison) et tri du total. */}
      <form
        action="/admin/commandes"
        method="get"
        className="card mt-4 flex flex-wrap items-end gap-3 p-4"
      >
        {active !== "all" ? <input type="hidden" name="filtre" value={active} /> : null}

        <label className="min-w-56 flex-1">
          <span className="label text-[11px]">{t("admin.search")}</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={t("admin.searchPlaceholder")}
            className="input"
          />
        </label>

        <label className="min-w-44">
          <span className="label text-[11px]">{t("admin.sort")}</span>
          <select name="tri" defaultValue={sort.value} className="input">
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.key)}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn-primary btn-sm">
          {t("admin.search")}
        </button>

        {search || sort.value !== "recent" ? (
          <Link href={filterHref("all")} className="btn-ghost btn-sm">
            {t("common.cancel")}
          </Link>
        ) : null}
      </form>

      {orders.length === 0 ? (
        <p className="muted mt-6">
          {search ? t("admin.noResults") : t("admin.noOrders")}
        </p>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-sand-100 text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-2">{t("order.reference")}</th>
                <th className="px-4 py-2">{t("admin.customer")}</th>
                <th className="px-4 py-2">{t("checkout.paymentMethod")}</th>
                <th className="px-4 py-2">{t("order.statusLabel")}</th>
                <th className="px-4 py-2">{t("order.paymentStatusLabel")}</th>
                <th className="px-4 py-2 text-right">{t("common.total")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-sand-200 hover:bg-sand-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/commandes/${order.id}`}
                      className="font-mono font-semibold hover:text-brand-700"
                    >
                      {order.reference}
                    </Link>
                    <p className="muted text-xs">
                      {formatDateTime(order.createdAt, locale === "mg" ? "fr-MG" : "fr-FR")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.customerName}</p>
                    <p className="muted text-xs">{order.customerPhone}</p>
                    {order.deliveryZoneLabel ? (
                      <p className="muted text-[11px]">{order.deliveryZoneLabel}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p>{t(PAYMENT_METHOD_LABEL_KEY[order.paymentMethod as PaymentMethodValue])}</p>
                    {order.paymentReference ? (
                      <p className="muted font-mono text-xs">{order.paymentReference}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge kind="order" value={order.status} locale={locale} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge kind="payment" value={order.paymentStatus} locale={locale} />
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700">
                    {formatMga(order.totalMga)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
