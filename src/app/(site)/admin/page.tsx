import type { Metadata } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatMga } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Back-office",
};

export default async function AdminDashboardPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const [revenue, pendingCount, verificationCount, recentOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { paymentStatus: "PAID" },
      _sum: { totalMga: true },
      _count: true,
    }),
    prisma.order.count({
      where: { status: { in: ["PENDING", "CONFIRMED", "IN_PRODUCTION"] } },
    }),
    prisma.order.count({ where: { paymentStatus: "AWAITING_VERIFICATION" } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const metrics = [
    {
      label: t("admin.metrics.revenue"),
      value: formatMga(revenue._sum.totalMga ?? 0),
      hint: `${revenue._count} commande(s) encaissée(s)`,
    },
    {
      label: t("admin.metrics.pending"),
      value: String(pendingCount),
      hint: t("admin.orders"),
    },
    {
      label: t("admin.metrics.verifications"),
      value: String(verificationCount),
      hint: t("paymentStatus.AWAITING_VERIFICATION"),
    },
  ];

  return (
    <div>
      <h1 className="section-title">{t("admin.title")}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-black text-brand-700">{metric.value}</p>
            <p className="muted mt-1 text-xs">{metric.hint}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("admin.orders")}</h2>
          <Link
            href="/admin/commandes"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            {t("products.all")} →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="muted mt-3">{t("admin.noOrders")}</p>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-sand-100 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2">{t("order.reference")}</th>
                  <th className="px-4 py-2">{t("admin.customer")}</th>
                  <th className="px-4 py-2">{t("checkout.delivery")}</th>
                  <th className="px-4 py-2">{t("order.statusLabel")}</th>
                  <th className="px-4 py-2">{t("order.paymentStatusLabel")}</th>
                  <th className="px-4 py-2 text-right">{t("common.total")}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-sand-200">
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
                      <p>{order.city}</p>
                      <p className="muted text-xs">
                        {order.deliveryMode === "PICKUP"
                          ? t("checkout.pickup")
                          : t("checkout.homeDelivery")}
                      </p>
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
      </section>
    </div>
  );
}
