import { formatDate } from "@/lib/format";
import { translate, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

/**
 * Notifications client.
 *
 * Le paiement Mobile Money est vérifié à la main par l'administrateur : la
 * notification est ce que le client reçoit après cette validation, avec le
 * délai de livraison annoncé. Aucune table supplémentaire n'est nécessaire —
 * les notifications sont dérivées des commandes récentes du client, ce qui
 * garantit qu'elles ne peuvent pas être fabriquées côté navigateur.
 */

/** Fenêtre d'affichage des notifications. */
const NOTIFICATION_WINDOW_DAYS = 30;
/** Délai retourné quand aucun délai n'est renseigné nulle part. */
const FALLBACK_DELIVERY_DAYS = 5;

export type DeliveryEstimate = {
  /** Nombre d'annoncé, à partir de la validation du paiement. */
  days: number;
  /** Date promise au client. */
  eta: Date;
};

type EstimateOrder = {
  deliveryMode: "PICKUP" | "HOME_DELIVERY";
  paidAt: Date | null;
  updatedAt: Date;
  deliveryZone: { etaDaysMax: number } | null;
  items: { product: { leadTimeDays: number } | null }[];
};

/**
 * Délai annoncé au client : production (délai du produit le plus long) puis
 * acheminement (délai maximal de la zone choisie, retrait sur place sinon).
 */
export function deliveryEstimate(order: EstimateOrder): DeliveryEstimate {
  const productionDays = order.items.reduce(
    (max, item) => Math.max(max, item.product?.leadTimeDays ?? 0),
    0,
  );
  const shippingDays =
    order.deliveryMode === "HOME_DELIVERY"
      ? (order.deliveryZone?.etaDaysMax ?? 2)
      : 0;

  const days = Math.max(1, productionDays + shippingDays || FALLBACK_DELIVERY_DAYS);
  const start = order.paidAt ?? order.updatedAt;

  return { days, eta: new Date(start.getTime() + days * 24 * 60 * 60 * 1000) };
}

export type CustomerNotification = {
  /** Identifiant stable : sert de clé de rendu et de marquage « lu ». */
  id: string;
  href: string;
  title: string;
  body: string;
  createdAt: Date;
};

/**
 * Dernières notifications du client : paiement validé (avec délai annoncé) ou
 * paiement refusé, sur les commandes des trente derniers jours.
 */
export async function listCustomerNotifications(
  userId: string,
  locale: Locale,
): Promise<CustomerNotification[]> {
  const since = new Date(Date.now() - NOTIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      userId,
      OR: [
        { paymentStatus: "PAID", paidAt: { gte: since } },
        { paymentStatus: "FAILED", updatedAt: { gte: since } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      reference: true,
      paymentStatus: true,
      deliveryMode: true,
      paidAt: true,
      updatedAt: true,
      deliveryZone: { select: { etaDaysMax: true } },
      items: { select: { product: { select: { leadTimeDays: true } } } },
    },
  });

  return orders.map((order) => {
    const t = (
      key: Parameters<typeof translate>[1],
      replacements?: Record<string, string | number>,
    ) => translate(locale, key, replacements);

    if (order.paymentStatus === "PAID") {
      const { days, eta } = deliveryEstimate(order);

      return {
        id: `${order.id}:paid`,
        href: `/commande/${order.reference}`,
        title: t("notif.paidTitle"),
        body: t("notif.paidBody", {
          reference: order.reference,
          days,
          date: formatDate(eta, locale === "mg" ? "fr-MG" : "fr-FR"),
        }),
        createdAt: order.paidAt ?? order.updatedAt,
      };
    }

    return {
      id: `${order.id}:failed`,
      href: `/commande/${order.reference}`,
      title: t("notif.failedTitle"),
      body: t("notif.failedBody", { reference: order.reference }),
      createdAt: order.updatedAt,
    };
  });
}
