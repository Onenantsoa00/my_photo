import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReviewForm } from "@/components/reviews/review-form";
import { Stars } from "@/components/reviews/stars";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDateTime, formatMga } from "@/lib/format";
import { translate, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import {
  PAYMENT_ACCOUNT_NAME,
  PAYMENT_METHOD_LABEL_KEY,
  type PaymentMethodValue,
} from "@/lib/payment";
import { storageUrl } from "@/lib/storage-url";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth";
import { deliveryEstimate } from "@/server/notifications";

type PageProps = { params: Promise<{ reference: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Commande ${reference}` };
}

export default async function OrderPage({ params }: PageProps) {
  const { reference } = await params;
  const locale = await getLocale();
  const t = (key: TranslationKey, replacements?: Record<string, string | number>) =>
    translate(locale, key, replacements);

  const [order, user] = await Promise.all([
    prisma.order.findUnique({
      where: { reference },
      include: {
        items: {
          include: {
            design: { select: { title: true } },
            product: { select: { leadTimeDays: true } },
          },
        },
        deliveryZone: { select: { etaDaysMax: true } },
        events: { orderBy: { createdAt: "asc" } },
        review: true,
      },
    }),
    getSessionUser(),
  ]);

  if (!order) notFound();

  // Une commande nominative n'est ouvrable que par son propriétaire ou par
  // l'équipe. Les commandes invitées restent accessibles par leur référence.
  const isOwner = order.userId !== null && order.userId === user?.id;
  const isGuestOrder = order.userId === null;
  const isAdmin = user?.role === "ADMIN";

  if (!isGuestOrder && !isOwner && !isAdmin) {
    notFound();
  }

  const paymentKey = PAYMENT_METHOD_LABEL_KEY[order.paymentMethod as PaymentMethodValue];
  const needsAction =
    order.paymentStatus === "PENDING" ||
    order.paymentStatus === "AWAITING_VERIFICATION";
  const paymentMotif =
    order.items
      .map((item) => item.design?.title?.trim())
      .filter((title): title is string => Boolean(title))
      .join(", ")
      .slice(0, 160) || order.reference;

  const dateLocale = locale === "mg" ? "fr-MG" : "fr-FR";
  // Paiement validé à la main par l'administrateur : on annonce le délai.
  const delivery = order.paymentStatus === "PAID" ? deliveryEstimate(order) : null;

  return (
    <div className="container-page py-10">
      <div className="card overflow-hidden">
        <div className="border-b border-brand-200 bg-brand-50 p-6">
          <p className="text-2xl font-black text-brand-800">✓ {t("order.thanks")}</p>
          <p className="mt-1 text-sm text-brand-700">
            {t("order.reference")} <strong className="font-mono">{order.reference}</strong>
            {" · "}
            {t("order.createdAt")} {formatDateTime(order.createdAt, locale === "mg" ? "fr-MG" : "fr-FR")}
          </p>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            <section>
              <h2 className="font-bold">{t("checkout.delivery")}</h2>
              <div className="mt-3 rounded-xl bg-sand-100 p-4 text-sm">
                <p className="font-semibold">
                  {order.deliveryMode === "PICKUP"
                    ? t("checkout.pickup")
                    : t("checkout.homeDelivery")}
                </p>
                {order.deliveryMode === "HOME_DELIVERY" ? (
                  <p className="mt-1 text-ink-700">
                    {order.addressLine}
                    <br />
                    {order.city} — {order.region}
                    {order.deliveryZoneLabel ? (
                      <>
                        <br />
                        <span className="text-xs text-ink-500">
                          {t("checkout.zone")} : {order.deliveryZoneLabel}
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-1 text-ink-700">Analakely, Antananarivo 101</p>
                )}
                <p className="mt-2 text-ink-700">
                  {order.customerName} · {order.customerPhone}
                </p>
              </div>
            </section>

            <section>
              <h2 className="font-bold">
                {t("admin.items")} ({order.items.length})
              </h2>
              <ul className="mt-3 space-y-2">
                {order.items.map((item) => {
                  const preview = storageUrl(item.previewPath);

                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-sand-200 p-3"
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                        {preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={preview}
                            alt={item.productName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-lg">
                            🖨️
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.productName}</p>
                        <p className="muted text-xs">
                          {item.variantLabel} × {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-brand-700">
                        {formatMga(item.lineTotalMga)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>

            {order.status === "DELIVERED" || order.review ? (
              <section id="avis" className="scroll-mt-24">
                <h2 className="font-bold">{t("review.summary")}</h2>

                {order.review ? (
                  <div className="mt-3 rounded-xl border border-sand-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars value={order.review.rating} />
                      <span className="text-xs font-semibold text-ink-700">
                        {t("review.verified")}
                      </span>
                    </div>
                    {order.review.comment ? (
                      <p className="mt-2 text-sm leading-relaxed text-ink-700">
                        {order.review.comment}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3">
                    <ReviewForm orderId={order.id} />
                  </div>
                )}
              </section>
            ) : null}

            <section>
              <h2 className="font-bold">{t("order.history")}</h2>
              <ol className="mt-3 space-y-3">
                {order.events.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    <div>
                      <p className="text-sm font-semibold">{t(`status.${event.status}`)}</p>
                      <p className="muted text-xs">
                        {formatDateTime(event.createdAt, locale === "mg" ? "fr-MG" : "fr-FR")}
                        {event.note ? ` · ${event.note}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-sand-200 p-4">
              <h2 className="text-sm font-bold">{t("checkout.payment")}</h2>
              <p className="mt-2 text-sm font-semibold">{t(paymentKey)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge kind="order" value={order.status} locale={locale} />
                <StatusBadge kind="payment" value={order.paymentStatus} locale={locale} />
              </div>

              {delivery ? (
                <div className="mt-3 rounded-xl bg-brand-100/70 p-3 ring-1 ring-brand-300 dark:bg-brand-900/40 dark:ring-brand-800">
                  <p className="text-xs font-bold text-brand-900 dark:text-brand-100">
                    ✓ {t("notif.paidTitle")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-brand-800 dark:text-brand-200">
                    {t("notif.deliveryEstimate", {
                      days: delivery.days,
                      date: formatDate(delivery.eta, dateLocale),
                    })}
                  </p>
                </div>
              ) : null}

              {order.paymentTarget ? (
                <p className="muted mt-2 text-xs">
                  {t("checkout.merchantNumber")} :{" "}
                  <span className="font-mono">{order.paymentTarget}</span>
                  <br />
                  {PAYMENT_ACCOUNT_NAME}
                </p>
              ) : null}

              {order.paymentReference ? (
                <p className="muted mt-2 text-xs">
                  {t("checkout.transactionRef")} :{" "}
                  <span className="font-mono">{order.paymentReference}</span>
                </p>
              ) : null}
            </div>

            {needsAction && order.paymentMethod !== "CASH_ON_DELIVERY" && order.paymentTarget ? (
              <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
                <h2 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  {t("order.payInstructions")}
                </h2>
                <p className="mt-2 text-xs text-amber-900 dark:text-amber-100">
                  {t("checkout.mobileMoneySteps")}
                </p>
                <p className="mt-3 font-mono text-lg font-black text-amber-900 dark:text-amber-100">
                  {order.paymentTarget}
                </p>
                <p className="text-xs text-amber-900 dark:text-amber-100">
                  {PAYMENT_ACCOUNT_NAME}
                </p>
                <p className="mt-2 text-xs text-amber-900 dark:text-amber-100">
                  {t("checkout.paymentMotif")} : <strong>{paymentMotif}</strong>
                </p>
                <p className="mt-1 text-xs text-amber-900 dark:text-amber-100">
                  {t("order.sentAmount")} {formatMga(order.totalMga)}
                </p>
              </div>
            ) : null}

            <div className="rounded-xl border border-sand-200 p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-700">{t("common.subtotal")}</dt>
                  <dd>{formatMga(order.subtotalMga)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-700">{t("checkout.deliveryFee")}</dt>
                  <dd>{formatMga(order.deliveryFeeMga)}</dd>
                </div>
                <div className="flex justify-between border-t border-sand-200 pt-2 text-base font-bold">
                  <dt>{t("order.total")}</dt>
                  <dd className="text-brand-700">{formatMga(order.totalMga)}</dd>
                </div>
              </dl>
            </div>

            <Link href={`/suivi?ref=${order.reference}`} className="btn-outline w-full">
              {t("nav.tracking")}
            </Link>
            <Link href="/compte" className="btn-ghost w-full">
              {t("order.seeOrders")}
            </Link>
            <Link href="/produits" className="btn-ghost w-full">
              {t("cart.continue")}
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
