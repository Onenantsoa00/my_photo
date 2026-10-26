import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatMga } from "@/lib/format";
import { translate } from "@/lib/i18n";
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

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { filtre } = await searchParams;
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const active = FILTERS.some((filter) => filter.value === filtre) ? filtre : "all";

  const orders = await prisma.order.findMany({
    where:
      active === "all"
        ? {}
        : active === "AWAITING_VERIFICATION"
          ? { paymentStatus: "AWAITING_VERIFICATION" }
          : { status: active as "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <h1 className="section-title">{t("admin.orders")}</h1>

      <nav className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "all" ? "/admin/commandes" : `/admin/commandes?filtre=${filter.value}`}
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

      {orders.length === 0 ? (
        <p className="muted mt-6">{t("admin.noOrders")}</p>
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
