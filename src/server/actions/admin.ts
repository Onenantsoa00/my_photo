"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth";
import { deliveryEstimate } from "@/server/notifications";

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

/** URL d'image acceptée : fichier servi par l'application ou adresse absolue. */
function imageUrlOrNull(value: FormDataEntryValue | null): string | null {
  const url = String(value ?? "").trim();

  if (!url) return null;
  if (!url.startsWith("/") && !/^https?:\/\//i.test(url)) return null;

  return url.slice(0, 600);
}

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

  // Le back-office confirme l'enregistrement par une notification.
  redirect(`/admin/commandes/${orderId}?saved=1`);
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
    select: {
      id: true,
      reference: true,
      paymentStatus: true,
      status: true,
      deliveryMode: true,
      paidAt: true,
      updatedAt: true,
      deliveryZone: { select: { etaDaysMax: true } },
      items: { select: { product: { select: { leadTimeDays: true } } } },
    },
  });

  if (!order) return;

  const approved = decision === "approve";

  // La validation est manuelle : le client est prévenu aussitôt, avec le délai
  // de livraison calculé à partir du produit et de la zone choisie.
  const estimate = approved
    ? deliveryEstimate({ ...order, paidAt: new Date() })
    : null;
  const deliveryNote = estimate
    ? `Livraison prévue sous ${estimate.days} jours (le ${formatDate(estimate.eta)})`
    : null;

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
        note: [note || (approved ? "Paiement vérifié et validé" : "Paiement rejeté"), deliveryNote]
          .filter(Boolean)
          .join(" · "),
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/compte");

  // Le back-office confirme l'enregistrement par une notification.
  redirect(`/admin/commandes/${orderId}?saved=1`);
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

  redirect("/admin/produits?saved=1");
}

export async function updateProductAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const productId = String(formData.get("productId") ?? "");
  const nameFr = String(formData.get("nameFr") ?? "").trim();
  const nameMg = String(formData.get("nameMg") ?? "").trim();
  const descriptionFr = String(formData.get("descriptionFr") ?? "").trim();
  const descriptionMg = String(formData.get("descriptionMg") ?? "").trim();
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
      ...(descriptionFr ? { descriptionFr } : {}),
      ...(descriptionMg ? { descriptionMg } : {}),
      imageUrl: imageUrlOrNull(formData.get("imageUrl")),
      basePriceMga: Math.round(basePriceMga),
      leadTimeDays: Number.isFinite(leadTimeDays) ? Math.max(0, Math.round(leadTimeDays)) : 2,
      isActive,
      isFeatured,
    },
  });

  revalidatePath("/admin/produits");
  revalidatePath("/produits", "layout");
  revalidatePath("/", "layout");

  redirect("/admin/produits?saved=1");
}

/** Ajoute une photo à la vitrine (page d'accueil et fiche produit). */
export async function addProductImageAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const productId = String(formData.get("productId") ?? "");
  const url = imageUrlOrNull(formData.get("url"));
  const altFr = String(formData.get("altFr") ?? "").trim().slice(0, 160);
  const altMg = String(formData.get("altMg") ?? "").trim().slice(0, 160);

  if (!productId || !url) return;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return;

  const last = await prisma.productImage.aggregate({
    where: { productId: product.id },
    _max: { sortOrder: true },
  });

  await prisma.productImage.create({
    data: {
      productId: product.id,
      url,
      altFr: altFr || null,
      altMg: altMg || altFr || null,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/admin/produits");
  revalidatePath("/produits", "layout");
  revalidatePath("/", "layout");

  redirect("/admin/produits?saved=1");
}

export async function deleteProductImageAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const imageId = String(formData.get("imageId") ?? "");
  if (!imageId) return;

  await prisma.productImage.deleteMany({ where: { id: imageId } });

  revalidatePath("/admin/produits");
  revalidatePath("/produits", "layout");
  revalidatePath("/", "layout");

  redirect("/admin/produits?saved=1");
}

export async function updateDeliveryZoneAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const zoneId = String(formData.get("zoneId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const feeMga = Number(formData.get("feeMga") ?? NaN);
  const etaDaysMin = Number(formData.get("etaDaysMin") ?? NaN);
  const etaDaysMax = Number(formData.get("etaDaysMax") ?? NaN);
  const isActive = formData.get("isActive") === "on";

  if (!zoneId || !Number.isFinite(feeMga) || feeMga < 0) return;

  await prisma.deliveryZone.update({
    where: { id: zoneId },
    data: {
      ...(name ? { name } : {}),
      ...(region ? { region } : {}),
      ...(city ? { city } : {}),
      feeMga: Math.round(feeMga),
      etaDaysMin: Number.isFinite(etaDaysMin) ? Math.max(0, Math.round(etaDaysMin)) : 1,
      etaDaysMax: Number.isFinite(etaDaysMax) ? Math.max(0, Math.round(etaDaysMax)) : 3,
      isActive,
    },
  });

  revalidatePath("/admin/zones");
  revalidatePath("/commande");
  revalidatePath("/", "layout");

  redirect("/admin/zones?saved=1");
}

// ---------------------------------------------------------------------------
// Gestion du catalogue et des zones
// ---------------------------------------------------------------------------

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "produit";
}

/** Référence unique : on ajoute un suffixe tant que le nom est pris. */
async function uniqueProductSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 1;

  while (await prisma.product.findUnique({ where: { slug }, select: { id: true } })) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  return slug;
}

async function uniqueVariantSku(base: string): Promise<string> {
  let sku = base;
  let attempt = 1;

  while (await prisma.productVariant.findUnique({ where: { sku }, select: { id: true } })) {
    attempt += 1;
    sku = `${base}-${attempt}`;
  }

  return sku;
}

/** Création d'un produit, avec un format « Standard » pour être vendable tout de suite. */
export async function createProductAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const nameFr = String(formData.get("nameFr") ?? "").trim();
  const nameMg = String(formData.get("nameMg") ?? "").trim();
  const descriptionFr = String(formData.get("descriptionFr") ?? "").trim();
  const basePriceMga = Number(formData.get("basePriceMga") ?? NaN);
  const leadTimeDays = Number(formData.get("leadTimeDays") ?? NaN);
  const isActive = formData.get("isActive") === "on";
  const isFeatured = formData.get("isFeatured") === "on";
  const variantLabel = String(formData.get("variantLabel") ?? "").trim();
  const imageUrl = imageUrlOrNull(formData.get("imageUrl"));

  if (!nameFr || !Number.isFinite(basePriceMga) || basePriceMga < 0) return;

  const requestedCategoryId = String(formData.get("categoryId") ?? "");
  const category = requestedCategoryId
    ? await prisma.category.findUnique({ where: { id: requestedCategoryId } })
    : await prisma.category.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });

  if (!category) return;

  const slug = await uniqueProductSlug(slugify(nameFr));
  const price = Math.round(basePriceMga);
  const last = await prisma.product.aggregate({
    where: { categoryId: category.id },
    _max: { sortOrder: true },
  });

  const product = await prisma.product.create({
    data: {
      slug,
      categoryId: category.id,
      nameFr,
      nameMg: nameMg || nameFr,
      descriptionFr: descriptionFr || nameFr,
      descriptionMg: nameMg || descriptionFr || nameFr,
      imageUrl,
      basePriceMga: price,
      leadTimeDays: Number.isFinite(leadTimeDays) ? Math.max(0, Math.round(leadTimeDays)) : 2,
      isActive,
      isFeatured,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });

  await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: await uniqueVariantSku(`${slug}-standard`),
      label: variantLabel || "Standard",
      priceMga: price,
      isDefault: true,
      isActive: true,
      sortOrder: 0,
    },
  });

  revalidatePath("/admin/produits");
  revalidatePath("/", "layout");

  redirect("/admin/produits?saved=1");
}

/**
 * Suppression d'un produit. L'historique des commandes est préservé :
 * les articles gardent leur libellé et leur prix saisis à l'époque.
 */
export async function deleteProductAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  await prisma.product.delete({ where: { id: productId } });

  revalidatePath("/admin/produits");
  revalidatePath("/produits");
  revalidatePath("/", "layout");

  redirect("/admin/produits?saved=1");
}

export async function createVariantAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const productId = String(formData.get("productId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const priceMga = Number(formData.get("priceMga") ?? NaN);
  const widthMm = Number(formData.get("widthMm") ?? NaN);
  const heightMm = Number(formData.get("heightMm") ?? NaN);

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true },
  });

  if (!product || !label || !Number.isFinite(priceMga) || priceMga < 0) return;

  const last = await prisma.productVariant.aggregate({
    where: { productId: product.id },
    _max: { sortOrder: true },
  });

  await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: await uniqueVariantSku(`${product.slug}-${slugify(label)}`),
      label,
      priceMga: Math.round(priceMga),
      widthMm: Number.isFinite(widthMm) && widthMm > 0 ? Math.round(widthMm) : null,
      heightMm: Number.isFinite(heightMm) && heightMm > 0 ? Math.round(heightMm) : null,
      isDefault: false,
      isActive: true,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/admin/produits");
  revalidatePath("/", "layout");

  redirect("/admin/produits?saved=1");
}

export async function deleteVariantAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const variantId = String(formData.get("variantId") ?? "");
  if (!variantId) return;

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, productId: true },
  });
  if (!variant) return;

  // Un produit sans format ne serait plus achetable : on garde toujours le
  // dernier format, l'admin peut le désactiver ou le renommer à la place.
  const count = await prisma.productVariant.count({ where: { productId: variant.productId } });
  if (count <= 1) return;

  await prisma.productVariant.delete({ where: { id: variantId } });

  revalidatePath("/admin/produits");
  revalidatePath("/", "layout");

  redirect("/admin/produits?saved=1");
}

export async function createDeliveryZoneAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const name = String(formData.get("name") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const feeMga = Number(formData.get("feeMga") ?? NaN);
  const etaDaysMin = Number(formData.get("etaDaysMin") ?? NaN);
  const etaDaysMax = Number(formData.get("etaDaysMax") ?? NaN);

  if (!name || !city || !Number.isFinite(feeMga) || feeMga < 0) return;

  await prisma.deliveryZone.create({
    data: {
      name,
      region: region || city,
      city,
      feeMga: Math.round(feeMga),
      etaDaysMin: Number.isFinite(etaDaysMin) ? Math.max(0, Math.round(etaDaysMin)) : 1,
      etaDaysMax: Number.isFinite(etaDaysMax) ? Math.max(0, Math.round(etaDaysMax)) : 3,
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidatePath("/admin/zones");
  revalidatePath("/commande");
  revalidatePath("/", "layout");

  redirect("/admin/zones?saved=1");
}

export async function deleteDeliveryZoneAction(formData: FormData): Promise<void> {
  const actor = await assertAdmin();
  if (!actor) return;

  const zoneId = String(formData.get("zoneId") ?? "");
  if (!zoneId) return;

  // Les commandes existantes ne référencent plus la zone (colonne nullable),
  // leur libellé figé et leur prix restent donc intacts.
  await prisma.deliveryZone.delete({ where: { id: zoneId } });

  revalidatePath("/admin/zones");
  revalidatePath("/commande");
  revalidatePath("/", "layout");

  redirect("/admin/zones?saved=1");
}
