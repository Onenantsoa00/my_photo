import type { Metadata } from "next";
import { ArrowRight, CircleCheck, Clock3, PackageSearch, Search, Truck } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDateTime, formatMga } from "@/lib/format";
import { translate, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth";
import { deliveryEstimate } from "@/server/notifications";

export const metadata: Metadata = {
  title: "Suivi de commande",
};

/**
 * Étapes d'une commande, dans l'ordre. La page de suivi s'en sert pour dessiner
 * la progression et pour annoncer la prochaine étape au client, sans qu'il ait
 * besoin d'ouvrir le détail de la commande.
 */
const PIPELINE = [
  "PENDING",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
] as const;

type PipelineStatus = (typeof PIPELINE)[number];

function pipelineIndex(status: string): number {
  return PIPELINE.indexOf(status as PipelineStatus);
}

function nextStatus(status: string): PipelineStatus | null {
  const index = pipelineIndex(status);

  if (index === -1 || index >= PIPELINE.length - 1) return null;
  return PIPELINE[index + 1];
}

const ORDER_INCLUDE = {
  events: { orderBy: { createdAt: "asc" } },
  deliveryZone: { select: { etaDaysMax: true } },
  items: { select: { product: { select: { leadTimeDays: true } } } },
} as const;

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const locale = await getLocale();
  const t = (
    key: TranslationKey,
    replacements?: Record<string, string | number>,
  ) => translate(locale, key, replacements);
  const dateLocale = locale === "mg" ? "fr-MG" : "fr-FR";

  const reference = (ref ?? "").trim();
  const user = await getSessionUser();

  const [found, orders] = await Promise.all([
    reference
      ? prisma.order.findFirst({
          where: { reference: { equals: reference, mode: "insensitive" } },
          include: ORDER_INCLUDE,
        })
      : null,
    user
      ? prisma.order.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: ORDER_INCLUDE,
        })
      : [],
  ]);

  const accessible =
    found !== null &&
    (found.userId === null || found.userId === user?.id || user?.role === "ADMIN");
  const tracked = accessible ? found : null;
  const trackedEstimate =
    tracked && tracked.paymentStatus === "PAID" ? deliveryEstimate(tracked) : null;
  const currentStep = tracked ? pipelineIndex(tracked.status) : -1;
  const upcoming = tracked ? nextStatus(tracked.status) : null;

  return (
    <div className="container-page py-10">
      <header className="max-w-2xl">
        <span className="badge-brand inline-flex items-center gap-1.5">
          <PackageSearch className="h-3.5 w-3.5" /> {t("nav.tracking")}
        </span>
        <h1 className="section-title mt-3">{t("tracking.title")}</h1>
        <p className="muted mt-2 text-base leading-relaxed">{t("tracking.subtitle")}</p>
      </header>

      {/* ------------------------------------------------------------ Recherche */}
      <form action="/suivi" method="get" className="card mt-6 flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-56 flex-1">
          <span className="label text-[11px]">{t("tracking.reference")}</span>
          <input
            type="search"
            name="ref"
            defaultValue={reference}
            placeholder={t("tracking.referenceHint")}
            className="input font-mono"
            aria-label={t("tracking.reference")}
          />
        </label>

        <button type="submit" className="btn-primary text-sm">
          <Search className="h-4 w-4" /> {t("tracking.search")}
        </button>
      </form>

      {reference && !tracked ? (
        <p className="mt-5 rounded-xl bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-700 dark:bg-accent-900/30 dark:text-accent-200">
          {t("tracking.notFound")}
        </p>
      ) : null}

      {/* ------------------------------------------------- Commande recherchée */}
      {tracked ? (
        <section className="card mt-6 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-sand-200 bg-sand-50/70 p-5 dark:bg-sand-100/40">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-lg font-black">{tracked.reference}</p>
              <p className="muted text-xs">
                {formatDateTime(tracked.createdAt, dateLocale)} ·{" "}
                {tracked.items.length} {t("admin.items").toLowerCase()} ·{" "}
                {formatMga(tracked.totalMga)}
              </p>
            </div>
            <StatusBadge kind="order" value={tracked.status} locale={locale} />
            <StatusBadge kind="payment" value={tracked.paymentStatus} locale={locale} />
          </div>

          <div className="p-5">
            {tracked.status === "CANCELLED" ? (
              <p className="text-sm font-semibold text-accent-600">
                {t("status.CANCELLED")}
              </p>
            ) : (
              <>
                <h2 className="text-sm font-bold">{t("tracking.progress")}</h2>

                <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {PIPELINE.map((step, index) => {
                    const done = currentStep >= 0 && index <= currentStep;

                    return (
                      <li
                        key={step}
                        className={
                          done
                            ? "rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 dark:border-brand-800 dark:bg-brand-900/30"
                            : "rounded-xl border border-sand-200 bg-card px-3 py-2"
                        }
                      >
                        <span className="flex items-center gap-1.5">
                          <CircleCheck
                            className={
                              done ? "h-4 w-4 text-brand-600" : "h-4 w-4 text-ink-400"
                            }
                          />
                          <span
                            className={
                              done
                                ? "text-[11px] font-bold text-brand-800 dark:text-brand-100"
                                : "text-[11px] font-semibold text-ink-500"
                            }
                          >
                            {t(`status.${step}`)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-sand-100 p-4 text-sm dark:bg-sand-200/50">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">
                  <Truck className="h-3.5 w-3.5" /> {t("checkout.delivery")}
                </p>
                <p className="mt-2 font-semibold">
                  {tracked.deliveryMode === "PICKUP"
                    ? t("checkout.pickup")
                    : `${tracked.city} — ${tracked.region}`}
                </p>
                {tracked.deliveryZoneLabel ? (
                  <p className="muted text-xs">
                    {t("checkout.zone")} : {tracked.deliveryZoneLabel}
                  </p>
                ) : null}
                {trackedEstimate ? (
                  <p className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
                    {t("tracking.etaLine", {
                      days: trackedEstimate.days,
                      date: formatDate(trackedEstimate.eta, dateLocale),
                    })}
                  </p>
                ) : null}
                {upcoming ? (
                  <p className="muted mt-2 flex items-center gap-1.5 text-xs">
                    <Clock3 className="h-3.5 w-3.5" />
                    {t("tracking.nextStep")} : <strong>{t(`status.${upcoming}`)}</strong>
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-sand-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-500">
                  {t("order.history")}
                </p>
                <ol className="mt-2 space-y-2">
                  {tracked.events.slice(-4).map((event) => (
                    <li key={event.id} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{t(`status.${event.status}`)}</p>
                        <p className="muted text-[11px]">
                          {formatDateTime(event.createdAt, dateLocale)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>

                <Link
                  href={`/commande/${tracked.reference}`}
                  className="btn-outline mt-3 w-full py-1.5 text-xs"
                >
                  {t("tracking.open")} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------- Mes commandes */}
      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <PackageSearch className="h-5 w-5 text-brand-600" /> {t("tracking.myOrders")}
        </h2>

        {!user ? (
          <p className="muted mt-3">
            {t("tracking.signIn")}{" "}
            <Link
              href="/connexion?next=/suivi"
              className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              {t("nav.signIn")}
            </Link>
          </p>
        ) : orders.length === 0 ? (
          <p className="muted mt-3">{t("tracking.empty")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {orders.map((order) => {
              const next = nextStatus(order.status);
              const lastEvent = order.events[order.events.length - 1];
              const estimate =
                order.paymentStatus === "PAID" ? deliveryEstimate(order) : null;

              return (
                <li key={order.id} className="card flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/commande/${order.reference}`}
                      className="font-mono text-sm font-bold hover:text-brand-700"
                    >
                      {order.reference}
                    </Link>
                    <p className="muted text-xs">
                      {order.userId === null ? `${t("tracking.guest")} · ` : ""}
                      {formatDate(order.createdAt, dateLocale)} ·{" "}
                      {formatMga(order.totalMga)}
                    </p>
                    <p className="muted text-[11px]">
                      {lastEvent
                        ? t("tracking.lastUpdate", {
                            date: formatDateTime(lastEvent.createdAt, dateLocale),
                          })
                        : null}
                      {next ? ` · ${t("tracking.nextStep")} : ${t(`status.${next}`)}` : ""}
                      {estimate
                        ? ` · ${t("tracking.etaLine", {
                            days: estimate.days,
                            date: formatDate(estimate.eta, dateLocale),
                          })}`
                        : ""}
                    </p>
                  </div>

                  <StatusBadge kind="order" value={order.status} locale={locale} />
                  <StatusBadge kind="payment" value={order.paymentStatus} locale={locale} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
