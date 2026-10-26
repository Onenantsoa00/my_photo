"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { normalizeDocument } from "@/lib/editor/types";
import { buildRelativePath, shortHash, writeStorageFile } from "@/lib/storage";
import type { TranslationKey } from "@/lib/i18n";
import { getActiveCart } from "@/server/cart";
import { designOwnerWhere, resolveDesignOwner } from "@/server/designs";

export type SaveDesignInput = {
  designId?: string | null;
  title: string;
  document: unknown;
  /** Aperçu PNG encodé en data URL, produit par le canvas Konva. */
  previewDataUrl?: string | null;
  productId?: string | null;
  targetWidthMm?: number | null;
  targetHeightMm?: number | null;
};

export type SaveDesignResult = {
  ok: boolean;
  designId?: string;
  errorKey?: TranslationKey;
};

const MAX_PREVIEW_CHARS = 8_000_000; // ~6 Mo de PNG décodé
const PREVIEW_MAX_SIDE = 1400;
const THUMB_MAX_SIDE = 420;

function decodeDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;

  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

async function persistPreview(
  previewDataUrl: string,
): Promise<{ previewPath: string | null; thumbnailPath: string | null }> {
  const buffer = decodeDataUrl(previewDataUrl);
  if (!buffer) return { previewPath: null, thumbnailPath: null };

  const signature = shortHash(buffer);

  const previewBuffer = await sharp(buffer)
    .resize({ width: PREVIEW_MAX_SIDE, height: PREVIEW_MAX_SIDE, fit: "inside" })
    .webp({ quality: 88 })
    .toBuffer();

  const previewPath = buildRelativePath("webp", `${signature}-preview-`);
  await writeStorageFile(previewPath, previewBuffer);

  const thumbnailBuffer = await sharp(buffer)
    .resize({ width: THUMB_MAX_SIDE, height: THUMB_MAX_SIDE, fit: "inside" })
    .webp({ quality: 78 })
    .toBuffer();

  const thumbnailPath = buildRelativePath("webp", `${signature}-thumb-`);
  await writeStorageFile(thumbnailPath, thumbnailBuffer);

  return { previewPath, thumbnailPath };
}

export async function saveDesignAction(
  input: SaveDesignInput,
): Promise<SaveDesignResult> {
  // `create: true` garantit un identifiant de session pour un visiteur, même
  // s'il n'a pas encore de panier : c'est ce qui rattache la création à lui.
  const owner = await resolveDesignOwner({ create: true });
  const ownerWhere = designOwnerWhere(owner);
  const document = normalizeDocument(input.document);

  if (document.layers.length === 0) {
    return { ok: false, errorKey: "editor.noLayers" };
  }

  if (!ownerWhere) {
    return { ok: false, errorKey: "editor.saveFailed" };
  }

  const title = input.title.trim().slice(0, 120) || "Création sans titre";

  let previewPath: string | null = null;
  let thumbnailPath: string | null = null;

  if (
    input.previewDataUrl &&
    input.previewDataUrl.length > 0 &&
    input.previewDataUrl.length < MAX_PREVIEW_CHARS
  ) {
    try {
      const persisted = await persistPreview(input.previewDataUrl);
      previewPath = persisted.previewPath;
      thumbnailPath = persisted.thumbnailPath;
    } catch {
      // L'aperçu est un confort : son échec ne doit pas perdre le document.
      previewPath = null;
      thumbnailPath = null;
    }
  }

  const shared = {
    title,
    canvasWidth: document.canvas.width,
    canvasHeight: document.canvas.height,
    targetWidthMm: input.targetWidthMm ?? null,
    targetHeightMm: input.targetHeightMm ?? null,
    document: document as unknown as object,
    productId: input.productId ?? null,
    ...(previewPath ? { previewPath, thumbnailPath } : {}),
  };

  // On ne réutilise un enregistrement existant que s'il appartient déjà à
  // l'appelant : sinon l'identifiant fourni écraserait la création d'autrui.
  if (input.designId) {
    const existing = await prisma.design.findFirst({
      where: { id: input.designId, ...ownerWhere },
      select: { id: true },
    });

    if (existing) {
      await prisma.design.update({ where: { id: existing.id }, data: shared });
      revalidatePath("/compte");
      return { ok: true, designId: existing.id };
    }
  }

  const created = await prisma.design.create({
    data: {
      ...shared,
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
    },
    select: { id: true },
  });

  revalidatePath("/compte");
  return { ok: true, designId: created.id };
}

export type OrderDesignResult = {
  ok: boolean;
  errorKey?: TranslationKey;
  cartPath?: string;
};

/**
 * « Commander cette création » : on enregistre le document, puis on ajoute une
 * ligne de panier liée à la création. Le design est conservé même si la
 * commande n'aboutit pas.
 */
export async function orderDesignAction(input: {
  designId?: string | null;
  title: string;
  document: unknown;
  previewDataUrl?: string | null;
  productId: string;
  variantId: string;
  quantity: number;
}): Promise<OrderDesignResult> {
  const variant = await prisma.productVariant.findFirst({
    where: { id: input.variantId, productId: input.productId, isActive: true },
    select: { id: true, priceMga: true },
  });

  if (!variant) {
    return { ok: false, errorKey: "editor.needProduct" };
  }

  const quantity = Math.max(1, Math.min(500, Math.trunc(input.quantity) || 1));

  const saved = await saveDesignAction({
    designId: input.designId,
    title: input.title,
    document: input.document,
    previewDataUrl: input.previewDataUrl,
    productId: input.productId,
  });

  if (!saved.ok || !saved.designId) {
    return { ok: false, errorKey: saved.errorKey ?? "editor.needProduct" };
  }

  const cart = await getActiveCart(true);
  if (!cart) {
    return { ok: false, errorKey: "editor.needProduct" };
  }

  const existing = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: input.productId,
      variantId: variant.id,
      designId: saved.designId,
    },
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
        productId: input.productId,
        variantId: variant.id,
        designId: saved.designId,
        quantity,
        unitPriceMga: variant.priceMga,
      },
    });
  }

  revalidatePath("/", "layout");

  return { ok: true, cartPath: "/panier" };
}
