import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";

export async function listCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
}

export async function listProducts(options: { categorySlug?: string } = {}) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      ...(options.categorySlug
        ? { category: { slug: options.categorySlug, isActive: true } }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }],
    include: {
      category: { select: { slug: true, nameFr: true, nameMg: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });
}

/**
 * Produits demandés par identifiant, dans l'ordre fourni (classement des
 * meilleures ventes par exemple).
 */
export async function listProductsByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
    include: {
      category: { select: { slug: true, nameFr: true, nameMg: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  return ids
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is (typeof products)[number] => Boolean(product));
}

/**
 * Produits les plus commandés : somme des quantités vendues, en ignorant les
 * commandes annulées. Sert à la section « Top ventes » de la vitrine.
 */
export async function listTopSellingProducts(take = 3) {
  const ranked = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { status: { not: "CANCELLED" } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take,
  });

  // Un article de commande garde son libellé même si le produit est supprimé :
  // seuls les identifiants encore présents entrent dans le classement.
  const products = await listProductsByIds(
    ranked
      .map((row) => row.productId)
      .filter((id): id is string => Boolean(id)),
  );

  return products.map((product) => ({
    product,
    sold: ranked.find((row) => row.productId === product.id)?._sum.quantity ?? 0,
  }));
}

export async function listFeaturedProducts(take = 4) {
  return prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { sortOrder: "asc" },
    take,
    include: {
      category: { select: { slug: true, nameFr: true, nameMg: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: { select: { slug: true, nameFr: true, nameMg: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findFirst({ where: { slug, isActive: true } });
}

export async function listDeliveryZones() {
  return prisma.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: [{ city: "asc" }, { feeMga: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// Localisation
// ---------------------------------------------------------------------------

type LocalizableProduct = {
  nameFr: string;
  nameMg: string;
  descriptionFr: string;
  descriptionMg: string | null;
};

export function productName(product: LocalizableProduct, locale: Locale): string {
  return locale === "mg" ? product.nameMg : product.nameFr;
}

export function productDescription(
  product: LocalizableProduct,
  locale: Locale,
): string {
  if (locale === "mg") {
    return product.descriptionMg ?? product.descriptionFr;
  }
  return product.descriptionFr;
}

type LocalizableCategory = {
  nameFr: string;
  nameMg: string;
  // Facultatif : les sélections imbriquées (ex. catégorie d'un produit) ne
  // chargent pas forcément les descriptions.
  descriptionFr?: string | null;
  descriptionMg?: string | null;
};

export function categoryName(category: LocalizableCategory, locale: Locale): string {
  return locale === "mg" ? category.nameMg : category.nameFr;
}

export function categoryDescription(
  category: LocalizableCategory,
  locale: Locale,
): string | null {
  return locale === "mg"
    ? (category.descriptionMg ?? category.descriptionFr ?? null)
    : (category.descriptionFr ?? null);
}

/** Prix le plus bas parmi les formats actifs, affiché sur les vignettes. */
export function lowestPrice(variants: { priceMga: number }[]): number | null {
  if (variants.length === 0) return null;
  return Math.min(...variants.map((variant) => variant.priceMga));
}

export function defaultVariantId(
  variants: { id: string; isDefault: boolean }[],
): string | null {
  if (variants.length === 0) return null;
  return (variants.find((variant) => variant.isDefault) ?? variants[0]).id;
}
