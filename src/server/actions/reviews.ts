"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { TranslationKey } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth";

export type ReviewState = {
  errorKey?: TranslationKey;
  ok?: boolean;
};

const reviewSchema = z.object({
  orderId: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(600).optional(),
});

/**
 * Enregistre l'avis d'un client sur une commande livrée.
 *
 * L'avis est facultatif et une seule note est acceptée par commande
 * (`orderId` unique en base). Il est publié immédiatement : l'équipe peut le
 * masquer depuis la base si nécessaire.
 */
export async function createReviewAction(
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const parsed = reviewSchema.safeParse({
    orderId: formData.get("orderId"),
    rating: formData.get("rating"),
    comment: formData.get("comment") || undefined,
  });

  if (!parsed.success) {
    return { errorKey: "review.invalid" };
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: {
      review: { select: { id: true } },
      items: { select: { productId: true } },
    },
  });

  if (!order) return { errorKey: "review.notAllowed" };
  if (order.review) return { errorKey: "review.already" };
  if (order.status !== "DELIVERED") return { errorKey: "review.notAllowed" };

  const user = await getSessionUser();
  const isOwner = order.userId !== null && order.userId === user?.id;
  // Une commande invitée n'a pas de propriétaire : sa référence sert de preuve.
  const isGuestOrder = order.userId === null;
  const isAdmin = user?.role === "ADMIN";

  if (!isOwner && !isGuestOrder && !isAdmin) {
    return { errorKey: "review.notAllowed" };
  }

  const productId =
    order.items.find((item) => item.productId !== null)?.productId ?? null;

  await prisma.review.create({
    data: {
      orderId: order.id,
      userId: order.userId ?? user?.id ?? null,
      productId,
      customerName: order.customerName.trim().slice(0, 120),
      rating: parsed.data.rating,
      comment: parsed.data.comment?.trim() || null,
    },
  });

  revalidatePath(`/commande/${order.reference}`);
  revalidatePath("/compte");
  revalidatePath("/produits", "layout");
  revalidatePath("/", "layout");

  return { ok: true };
}
