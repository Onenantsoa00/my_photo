import { prisma } from "@/lib/prisma";
import { countDocumentPages } from "@/lib/editor/types";

import {
  ensureCartSessionId,
  getCartSessionId,
  getSessionUser,
} from "@/server/auth";

export type CartLine = Awaited<ReturnType<typeof getCartDetail>>["items"][number];

/**
 * Un visiteur a un panier lié à son cookie de session, un client connecté a un
 * panier lié à son compte. `createIfMissing` écrit un cookie : à n'appeler que
 * depuis une Server Action ou un Route Handler.
 */
export async function getActiveCart(createIfMissing = false) {
  const user = await getSessionUser();

  if (user) {
    const existing = await prisma.cart.findUnique({ where: { userId: user.id } });
    if (existing) return existing;
    if (!createIfMissing) return null;
    return prisma.cart.create({ data: { userId: user.id } });
  }

  const sessionId = createIfMissing
    ? await ensureCartSessionId()
    : await getCartSessionId();

  if (!sessionId) return null;

  const existing = await prisma.cart.findUnique({ where: { sessionId } });
  if (existing) return existing;
  if (!createIfMissing) return null;

  return prisma.cart.create({ data: { sessionId } });
}

export async function getCartDetail() {
  const cart = await getActiveCart(false);

  if (!cart) {
    return {
      cartId: null as string | null,
      items: [] as CartItemDetail[],
      subtotalMga: 0,
      itemCount: 0,
    };
  }

  const rows = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          nameFr: true,
          nameMg: true,
          leadTimeDays: true,
          category: { select: { slug: true } },
        },
      },
      variant: { select: { id: true, label: true, widthMm: true, heightMm: true } },
      design: {
        select: {
          id: true,
          title: true,
          previewPath: true,
          thumbnailPath: true,
          document: true,
        },
      },
    },
  });

  const items = rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    designId: row.designId,
    quantity: row.quantity,
    unitPriceMga: row.unitPriceMga,
    lineTotalMga: row.unitPriceMga * row.quantity,
    productSlug: row.product.slug,
    categorySlug: row.product.category.slug,
    productNameFr: row.product.nameFr,
    productNameMg: row.product.nameMg,
    leadTimeDays: row.product.leadTimeDays,
    variantLabel: row.variant.label,
    previewPath: row.design?.previewPath ?? row.design?.thumbnailPath ?? null,
    designTitle: row.design?.title ?? null,
    pageCount: row.design ? countDocumentPages(row.design.document) : null,
  }));

  const subtotalMga = items.reduce((sum, item) => sum + item.lineTotalMga, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { cartId: cart.id, items, subtotalMga, itemCount };
}

type CartItemDetail = {
  id: string;
  productId: string;
  variantId: string;
  designId: string | null;
  quantity: number;
  unitPriceMga: number;
  lineTotalMga: number;
  productSlug: string;
  categorySlug: string;
  productNameFr: string;
  productNameMg: string;
  leadTimeDays: number;
  variantLabel: string;
  previewPath: string | null;
  designTitle: string | null;
  pageCount: number | null;
};

export async function getCartItemCount(): Promise<number> {
  const cart = await getActiveCart(false);
  if (!cart) return 0;

  const result = await prisma.cartItem.aggregate({
    where: { cartId: cart.id },
    _sum: { quantity: true },
  });

  return result._sum.quantity ?? 0;
}

/**
 * À la connexion, le panier invité est rattaché au compte : personne ne perd
 * ce qu'il avait mis de côté.
 */
export async function mergeGuestCartIntoUser(userId: string): Promise<void> {
  const sessionId = await getCartSessionId();
  if (!sessionId) return;

  const guestCart = await prisma.cart.findUnique({
    where: { sessionId },
    include: { items: true },
  });

  if (!guestCart) return;

  const userCart = await prisma.cart.findUnique({ where: { userId } });

  if (!userCart) {
    await prisma.cart.update({
      where: { id: guestCart.id },
      data: { userId, sessionId: null },
    });
    return;
  }

  for (const item of guestCart.items) {
    const twin = await prisma.cartItem.findFirst({
      where: {
        cartId: userCart.id,
        productId: item.productId,
        variantId: item.variantId,
        designId: item.designId,
      },
    });

    if (twin) {
      await prisma.cartItem.update({
        where: { id: twin.id },
        data: { quantity: twin.quantity + item.quantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: userCart.id,
          productId: item.productId,
          variantId: item.variantId,
          designId: item.designId,
          quantity: item.quantity,
          unitPriceMga: item.unitPriceMga,
        },
      });
    }
  }

  await prisma.cart.delete({ where: { id: guestCart.id } });
}
