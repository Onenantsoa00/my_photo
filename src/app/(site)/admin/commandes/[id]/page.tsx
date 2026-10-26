import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatMga } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { PAYMENT_METHOD_LABEL_KEY, type PaymentMethodValue } from "@/lib/payment";
import { prisma } from "@/lib/prisma";
import { storageUrl } from "@/lib/storage-url";
import { reviewPaymentAction, updateOrderStatusAction } from "@/server/actions/admin";

export const metadata: Metadata = {
  title: "Détail commande",
};

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { design: { select: { id: true, title: true } } } },
      events: { orderBy: { createdAt: "desc" } },
      user: { select: { email: true, name: true } },
    },
  });

  if (!order) notFound();

  const method = order.paymentMethod as PaymentMethodValue;
  const isCashOnDelivery = method === "CASH_ON_DELIVERY";
  // Un paiement Mobile Money arrive en attente de vérification, un paiement à
  // la livraison reste simplement en attente jusqu'à l'encaissement effectif.
  const paymentActionable =
    order.paymentStatus === "AWAITING_VERIFICATION" || order.paymentStatus === "PENDING";

  return (
    <div>
      <nav className="muted flex items-center gap-2">
        <Link href="/admin/commandes" className="hover:text-brand-700">
          {t("admin.orders")}
        </Link>
        <span>/</span>
        <span className="font-mono text-ink-700">{order.reference}</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-black">{order.reference}</h1>
        <StatusBadge kind="order" value={order.status} locale={locale} />
        <StatusBadge kind="payment" value={order.paymentStatus} locale={locale} />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-bold">{t("admin.items")}</h2>

            <ul className="mt-3 divide-y divide-sand-200">
              {order.items.map((item) => {
                const preview = storageUrl(item.previewPath);

                return (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt={item.productName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-xl">
                          🖨️
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.productName}</p>
                      <p className="muted text-xs">
                        {item.variantLabel} × {item.quantity}
                      </p>
                      {item.design ? (
                        <Link
                          href={`/editeur?design=${item.design.id}`}
                          className="text-xs font-semibold text-brand-700 hover:underline"
                        >
                          🎨 {item.design.title}
                        </Link>
                      ) : null}
                    </div>

                    <p className="font-bold text-brand-700">
                      {formatMga(item.lineTotalMga)}
                    </p>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-4 space-y-1 border-t border-sand-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-700">{t("common.subtotal")}</dt>
                <dd>{formatMga(order.subtotalMga)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-700">{t("checkout.deliveryFee")}</dt>
                <dd>{formatMga(order.deliveryFeeMga)}</dd>
              </div>
              <div className="flex justify-between text-base font-bold">
                <dt>{t("order.total")}</dt>
                <dd className="text-brand-700">{formatMga(order.totalMga)}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="font-bold">{t("order.history")}</h2>

            <form action={updateOrderStatusAction} className="mt-3 space-y-3">
              <input type="hidden" name="orderId" value={order.id} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="status">
                    {t("admin.updateStatus")}
                  </label>
                  <select id="status" name="status" className="input" defaultValue={order.status}>
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {t(`status.${status}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="note">
                    {t("admin.adminNote")}
                  </label>
                  <input id="note" name="note" className="input" />
                </div>
              </div>

              <button type="submit" className="btn-primary">
                {t("common.save")}
              </button>
            </form>

            <ol className="mt-5 space-y-3 border-t border-sand-200 pt-4">
              {order.events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div>
                    <p className="text-sm font-semibold">{t(`status.${event.status}`)}</p>
                    <p className="muted text-xs">
                      {formatDateTime(event.createdAt, locale === "mg" ? "fr-MG" : "fr-FR")} ·{" "}
                      {event.actor}
                      {event.note ? ` · ${event.note}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          {paymentActionable ? (
            <section
              className={
                isCashOnDelivery
                  ? "card border-brand-200 bg-brand-50 p-5"
                  : "card border-amber-300 bg-amber-50 p-5"
              }
            >
              <h2 className={isCashOnDelivery ? "font-bold text-brand-900" : "font-bold text-amber-900"}>
                {isCashOnDelivery ? t("admin.codTitle") : t("admin.validatePayment")}
              </h2>
              <p className={isCashOnDelivery ? "mt-2 text-xs text-brand-800" : "mt-2 text-xs text-amber-900"}>
                {isCashOnDelivery ? t("admin.codHint") : t("checkout.mobileMoneyHint")}
              </p>

              <dl
                className={
                  isCashOnDelivery
                    ? "mt-3 space-y-1 text-sm text-brand-900"
                    : "mt-3 space-y-1 text-sm text-amber-900"
                }
              >
                <div className="flex justify-between">
                  <dt>{t("checkout.paymentMethod")}</dt>
                  <dd className="font-semibold">{t(PAYMENT_METHOD_LABEL_KEY[method])}</dd>
                </div>

                {!isCashOnDelivery ? (
                  <>
                    <div className="flex justify-between">
                      <dt>{t("checkout.merchantNumber")}</dt>
                      <dd className="font-mono">{order.paymentTarget ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>{t("checkout.transactionRef")}</dt>
                      <dd className="font-mono font-bold">{order.paymentReference ?? "—"}</dd>
                    </div>
                  </>
                ) : null}

                <div className="flex justify-between">
                  <dt>{isCashOnDelivery ? t("order.total") : t("order.sentAmount")}</dt>
                  <dd className="font-semibold">{formatMga(order.totalMga)}</dd>
                </div>
              </dl>

              <form action={reviewPaymentAction} className="mt-4 space-y-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input
                  name="note"
                  className="input"
                  placeholder={t("admin.adminNote")}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    name="decision"
                    value="approve"
                    className="btn-primary flex-1"
                  >
                    ✓ {t("admin.paymentReceived")}
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="reject"
                    className="btn-outline flex-1 text-accent-600"
                  >
                    {t("admin.paymentNotReceived")}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="card p-5">
            <h2 className="font-bold">{t("admin.customer")}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-ink-500">{t("checkout.fullName")}</dt>
                <dd className="font-semibold">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-ink-500">{t("checkout.phone")}</dt>
                <dd>{order.customerPhone}</dd>
              </div>
              <div>
                <dt className="text-ink-500">{t("checkout.email")}</dt>
                <dd className="break-all">{order.customerEmail}</dd>
              </div>
              {order.user ? (
                <div>
                  <dt className="text-ink-500">Compte</dt>
                  <dd className="break-all">{order.user.email}</dd>
                </div>
              ) : (
                <div>
                  <dt className="text-ink-500">Compte</dt>
                  <dd className="text-ink-500">Commande invitée</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="font-bold">{t("checkout.delivery")}</h2>
            <div className="mt-3 text-sm">
              <p className="font-semibold">
                {order.deliveryMode === "PICKUP"
                  ? t("checkout.pickup")
                  : t("checkout.homeDelivery")}
              </p>
              {order.addressLine ? <p>{order.addressLine}</p> : null}
              <p>
                {order.city} — {order.region}
              </p>
              {order.deliveryZoneLabel ? (
                <p className="muted text-xs">{order.deliveryZoneLabel}</p>
              ) : null}
            </div>

            {order.customerNote ? (
              <div className="mt-4 rounded-lg bg-sand-100 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {t("checkout.note")}
                </p>
                <p className="mt-1">{order.customerNote}</p>
              </div>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="font-bold">{t("checkout.payment")}</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">{t("checkout.paymentMethod")}</dt>
                <dd className="font-semibold">{t(PAYMENT_METHOD_LABEL_KEY[method])}</dd>
              </div>
              {order.paidAt ? (
                <div className="flex justify-between">
                  <dt className="text-ink-500">{t("paymentStatus.PAID")}</dt>
                  <dd>
                    {formatDateTime(order.paidAt, locale === "mg" ? "fr-MG" : "fr-FR")}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
