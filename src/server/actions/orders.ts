"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { TranslationKey } from "@/lib/i18n";
import {
  PAYMENT_METHODS,
  initialPaymentStatus,
  isValidTransactionReference,
  paymentTargetFor,
  requiresTransactionReference,
  type PaymentMethodValue,
} from "@/lib/payment";
import { getSessionUser } from "@/server/auth";
import { getActiveCart } from "@/server/cart";

export type CheckoutState = {
  errorKey?: TranslationKey;
  fieldErrors?: Record<string, string>;
};

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.email().trim().toLowerCase(),
  customerPhone: z.string().trim().min(6).max(32),
  deliveryMode: z.enum(["PICKUP", "HOME_DELIVERY"]),
  deliveryZoneId: z.string().trim().optional(),
  addressLine: z.string().trim().max(240).optional(),
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentReference: z.string().trim().max(64).optional(),
  customerNote: z.string().trim().max(600).optional(),
});

/** Référence lisible du type MP-2026-A1B2C3. */
function buildReference(): string {
  const year = new Date().getFullYear();
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `MP-${year}-${suffix}`;
}

export async function createOrderAction(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse({
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail"),
    customerPhone: formData.get("customerPhone"),
    deliveryMode: formData.get("deliveryMode"),
    deliveryZoneId: formData.get("deliveryZoneId") ?? undefined,
    addressLine: formData.get("addressLine") ?? undefined,
    city: formData.get("city") ?? undefined,
    region: formData.get("region") ?? undefined,
    paymentMethod: formData.get("paymentMethod"),
    paymentReference: formData.get("paymentReference") ?? undefined,
    customerNote: formData.get("customerNote") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = "invalid";
    }
    return { fieldErrors };
  }

  const data = parsed.data;
  const method = data.paymentMethod as PaymentMethodValue;

  const cart = await getActiveCart(false);

  if (!cart) {
    return { errorKey: "cart.empty" };
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    include: {
      product: { select: { id: true, nameFr: true, leadTimeDays: true } },
      variant: { select: { id: true, label: true } },
      design: { select: { id: true, previewPath: true, thumbnailPath: true } },
    },
  });

  if (cartItems.length === 0) {
    return { errorKey: "cart.empty" };
  }

  // ---------------------------------------------------------------- livraison
  let deliveryFeeMga = 0;
  let deliveryZoneLabel: string | null = null;
  let deliveryZoneId: string | null = null;
  let city = data.city ?? "";
  let region = data.region ?? "";
  let addressLine: string | null = data.addressLine ?? null;

  if (data.deliveryMode === "HOME_DELIVERY") {
    if (!data.deliveryZoneId) {
      return { fieldErrors: { deliveryZoneId: "required" } };
    }

    const zone = await prisma.deliveryZone.findFirst({
      where: { id: data.deliveryZoneId, isActive: true },
    });

    if (!zone) {
      return { fieldErrors: { deliveryZoneId: "invalid" } };
    }

    deliveryFeeMga = zone.feeMga;
    deliveryZoneLabel = zone.name;
    deliveryZoneId = zone.id;
    // La zone fait foi pour la ville et la région : moins de saisie, moins
    // d'erreurs de tri pour l'atelier.
    city = zone.city;
    region = zone.region;

    if (!addressLine || addressLine.length < 5) {
      return { fieldErrors: { addressLine: "required" } };
    }
  } else {
    addressLine = null;
    city = city || "Antananarivo";
    region = region || "Analamanga";
  }

  // ------------------------------------------------------------------ paiement
  let paymentReference = data.paymentReference?.trim() || null;
  const paymentTarget = paymentTargetFor(method);

  if (requiresTransactionReference(method)) {
    if (!paymentReference || !isValidTransactionReference(paymentReference)) {
      return { fieldErrors: { paymentReference: "required" } };
    }
  } else {
    paymentReference = null;
  }

  // ------------------------------------------------------------------- totaux
  const subtotalMga = cartItems.reduce(
    (sum, item) => sum + item.unitPriceMga * item.quantity,
    0,
  );
  const totalMga = subtotalMga + deliveryFeeMga;

  const user = await getSessionUser();

  // La référence est unique en base : on retente en cas de collision.
  let createdReference: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 5 && !createdReference; attempt += 1) {
    const reference = buildReference();

    try {
      const order = await prisma.order.create({
        data: {
          reference,
          userId: user?.id ?? null,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          deliveryMode: data.deliveryMode,
          deliveryZoneId,
          deliveryZoneLabel,
          addressLine,
          city,
          region,
          deliveryFeeMga,
          subtotalMga,
          totalMga,
          paymentMethod: method,
          paymentStatus: initialPaymentStatus(method),
          paymentReference,
          paymentTarget,
          customerNote: data.customerNote ?? null,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              designId: item.designId,
              productName: item.product.nameFr,
              variantLabel: item.variant.label,
              quantity: item.quantity,
              unitPriceMga: item.unitPriceMga,
              lineTotalMga: item.unitPriceMga * item.quantity,
              previewPath:
                item.design?.previewPath ?? item.design?.thumbnailPath ?? null,
            })),
          },
          events: {
            create: [
              {
                status: "PENDING",
                actor: "customer",
                note:
                  method === "CASH_ON_DELIVERY"
                    ? "Commande reçue, paiement à la livraison"
                    : `Commande reçue, paiement ${method} déclaré (réf. ${paymentReference})`,
              },
            ],
          },
        },
        select: { reference: true },
      });

      createdReference = order.reference;
    } catch (error) {
      lastError = error;
    }
  }

  if (!createdReference) {
    console.error("Création de commande impossible", lastError);
    return { errorKey: "checkout.orderFailed" };
  }

  // Le panier est vidé seulement après écriture réussie de la commande.
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  revalidatePath("/", "layout");
  redirect(`/commande/${createdReference}`);
}
