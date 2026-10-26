"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getActiveCart } from "@/server/cart";
import { assertOwnsDesign } from "@/server/designs";

export type CartActionResult = {
  ok: boolean;
  message?: string;
};

function revalidateCart() {
  // Le compteur du panier vit dans le layout : on le rafraîchit partout.
  revalidatePath("/", "layout");
}

export async function addToCartAction(
  _previous: CartActionResult,
  formData: FormData,
): Promise<CartActionResult> {
  const productId = String(formData.get("productId") ?? "");
  const variantId = String(formData.get("variantId") ?? "");
  const designIdRaw = String(formData.get("designId") ?? "");
  const designId = designIdRaw && designIdRaw !== "none" ? designIdRaw : null;
  const quantity = Math.max(1, Math.min(500, Number(formData.get("quantity") ?? 1) || 1));

  if (!productId || !variantId) {
    return { ok: false, message: "invalid" };
  }

  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId, isActive: true },
    select: { id: true, priceMga: true },
  });

  if (!variant) {
    return { ok: false, message: "invalid" };
  }

  // L'identifiant de création vient du formulaire : sans ce contrôle, n'importe
  // quel visiteur pourrait rattacher la composition d'un autre à son panier.
  if (designId && !(await assertOwnsDesign(designId))) {
    return { ok: false, message: "invalid" };
  }

  const cart = await getActiveCart(true);
  if (!cart) {
    return { ok: false, message: "invalid" };
  }

  // Deux ajouts identiques (même produit, même format, même création) sont
  // fusionnés plutôt que dupliqués.
  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId, variantId, designId },
  });

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: Math.min(500, existing.quantity + quantity) },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId,
        designId,
        quantity,
        unitPriceMga: variant.priceMga,
      },
    });
  }

  revalidateCart();
  return { ok: true, message: "added" };
}

export async function updateCartItemAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);

  if (!itemId) return;

  const cart = await getActiveCart(false);
  if (!cart) return;

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
  });
  if (!item) return;

  if (quantity < 1) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: Math.min(500, quantity) },
    });
  }

  revalidateCart();
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  const cart = await getActiveCart(false);
  if (!cart) return;

  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });

  revalidateCart();
}

export async function clearCartAction(): Promise<void> {
  const cart = await getActiveCart(false);
  if (!cart) return;

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  revalidateCart();
}
