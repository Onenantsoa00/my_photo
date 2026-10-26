"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth";

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

type OrderStatusValue = (typeof ORDER_STATUSES)[number];

async function assertAdmin(): Promise<string | null> {
  const user = await getSessionUser();

  if (!user || user.role !== "ADMIN") return null;

  // Un compte administrateur peut ne pas avoir d'e-mail (créé par WhatsApp) :
  // l'acteur journalisé ne doit jamais être vide, sinon l'action serait
  // silencieusement ignorée.
  return user.email ?? user.phone ?? `admin:${user.id}`;
}

export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatusValue;
  const note = String(formData.get("note") ?? "").trim();

  if (!orderId || !ORDER_STATUSES.includes(status)) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });

  if (!order || order.status === status) return;

  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status } }),
    prisma.orderEvent.create({
      data: {
        orderId,
        status,
        actor,
        note: note || null,
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/compte");
}

/**
 * Valide (ou rejette) un paiement Mobile Money déclaré. C'est le contrôle
 * humain qui remplace l'absence d'API de collecte automatique.
 */
export async function reviewPaymentAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const orderId = String(formData.get("orderId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!orderId || (decision !== "approve" && decision !== "reject")) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, reference: true, paymentStatus: true, status: true },
  });

  if (!order) return;

  const approved = decision === "approve";

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: approved ? "PAID" : "FAILED",
        paidAt: approved ? new Date() : null,
        // Un paiement validé fait passer la commande en production ; l'équipe
        // peut ensuite la faire avancer manuellement.
        ...(approved && order.status === "PENDING"
          ? { status: "CONFIRMED" as const }
          : {}),
      },
    }),
    prisma.orderEvent.create({
      data: {
        orderId,
        status: approved ? "CONFIRMED" : order.status,
        actor,
        note: note
          ? note
          : approved
            ? "Paiement vérifié et validé"
            : "Paiement rejeté",
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/compte");
}

export async function updateVariantAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const variantId = String(formData.get("variantId") ?? "");
  const priceMga = Number(formData.get("priceMga") ?? NaN);
  const isActive = formData.get("isActive") === "on";

  if (!variantId || !Number.isFinite(priceMga) || priceMga < 0) return;

  await prisma.productVariant.update({
    where: { id: variantId },
    data: { priceMga: Math.round(priceMga), isActive },
  });

  revalidatePath("/admin/produits");
  revalidatePath("/", "layout");
}

export async function updateProductAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const productId = String(formData.get("productId") ?? "");
  const nameFr = String(formData.get("nameFr") ?? "").trim();
  const nameMg = String(formData.get("nameMg") ?? "").trim();
  const basePriceMga = Number(formData.get("basePriceMga") ?? NaN);
  const leadTimeDays = Number(formData.get("leadTimeDays") ?? NaN);
  const isActive = formData.get("isActive") === "on";
  const isFeatured = formData.get("isFeatured") === "on";

  if (!productId || !nameFr || !Number.isFinite(basePriceMga)) return;

  await prisma.product.update({
    where: { id: productId },
    data: {
      nameFr,
      nameMg: nameMg || nameFr,
      basePriceMga: Math.round(basePriceMga),
      leadTimeDays: Number.isFinite(leadTimeDays) ? Math.max(0, Math.round(leadTimeDays)) : 2,
      isActive,
      isFeatured,
    },
  });

  revalidatePath("/admin/produits");
  revalidatePath("/", "layout");
}

export async function updateDeliveryZoneAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const zoneId = String(formData.get("zoneId") ?? "");
  const feeMga = Number(formData.get("feeMga") ?? NaN);
  const etaDaysMin = Number(formData.get("etaDaysMin") ?? NaN);
  const etaDaysMax = Number(formData.get("etaDaysMax") ?? NaN);
  const isActive = formData.get("isActive") === "on";

  if (!zoneId || !Number.isFinite(feeMga) || feeMga < 0) return;

  await prisma.deliveryZone.update({
    where: { id: zoneId },
    data: {
      feeMga: Math.round(feeMga),
      etaDaysMin: Number.isFinite(etaDaysMin) ? Math.max(0, Math.round(etaDaysMin)) : 1,
      etaDaysMax: Number.isFinite(etaDaysMax) ? Math.max(0, Math.round(etaDaysMax)) : 3,
      isActive,
    },
  });

  revalidatePath("/admin/zones");
  revalidatePath("/commande");
}
