import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  PHOTOBOOK_BASE_PRICE_MGA,
  PHOTOBOOK_EXTRA_PAGE_MGA,
  PHOTOBOOK_MIN_PAGES,
  PHOTOBOOK_SLUG,
  photobookVariantSeeds,
} from "../src/lib/photobook";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL manquant : impossible de seeder la base.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PHOTOBOOK_CATEGORY_SLUG = "photobooks";

// ---------------------------------------------------------------------------
// Catalogue : un seul produit, le photobook (A4, A5, A6, carré)
// ---------------------------------------------------------------------------

const PHOTOBOOK_VARIANTS = photobookVariantSeeds();

const CATALOG = [
  {
    slug: PHOTOBOOK_CATEGORY_SLUG,
    nameFr: "Photobooks",
    nameMg: "Photobooks",
    descriptionFr:
      "Des livres photo reliés, imprimés page par page à 300 dpi, en A4, A5, A6 ou carré. 20 pages minimum, puis autant de pages que vous voulez.",
    descriptionMg:
      "Boky sary voafatotra, pirinty isaky ny pejy amin'ny 300 dpi, amin'ny habe A4, A5, A6 na kare. Pejy 20 farafahakeliny, avy eo araka izay tianao.",
    products: [
      {
        slug: PHOTOBOOK_SLUG,
        nameFr: "Photobook",
        nameMg: "Photobook",
        descriptionFr: `Livre photo relié au format de votre choix : A4, A5, A6 ou carré 20 × 20 cm, portrait ou paysage. ${PHOTOBOOK_MIN_PAGES} pages incluses pour 15 000 Ar, puis 1 000 Ar par page supplémentaire. Couverture solide (+ 5 000 Ar) ou moyen solide.`,
        descriptionMg: `Boky sary voafatotra amin'ny habe safidinao : A4, A5, A6 na kare 20 × 20 sm, mitsangana na mandry. Pejy ${PHOTOBOOK_MIN_PAGES} tafiditra amin'ny 15 000 Ar, avy eo 1 000 Ar isaky ny pejy fanampiny. Fonony mafy (+ 5 000 Ar) na semi-rigide.`,
        basePriceMga: PHOTOBOOK_BASE_PRICE_MGA,
        leadTimeDays: 5,
        isFeatured: true,
        variants: PHOTOBOOK_VARIANTS,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Zones de livraison
// ---------------------------------------------------------------------------

const ZONES = [
  { name: "Antananarivo — Centre", region: "Analamanga", city: "Antananarivo", feeMga: 8000, etaDaysMin: 1, etaDaysMax: 2 },
  { name: "Antananarivo — Périphérie", region: "Analamanga", city: "Antananarivo", feeMga: 12000, etaDaysMin: 1, etaDaysMax: 2 },
  { name: "Ambohidratrimo / Avaradrano", region: "Analamanga", city: "Ambohidratrimo", feeMga: 15000, etaDaysMin: 2, etaDaysMax: 3 },
  { name: "Antsirabe", region: "Vakinankaratra", city: "Antsirabe", feeMga: 20000, etaDaysMin: 2, etaDaysMax: 4 },
  { name: "Ambositra", region: "Amoron'i Mania", city: "Ambositra", feeMga: 25000, etaDaysMin: 3, etaDaysMax: 5 },
  { name: "Toamasina", region: "Atsinanana", city: "Toamasina", feeMga: 25000, etaDaysMin: 2, etaDaysMax: 4 },
  { name: "Fianarantsoa", region: "Haute Matsiatra", city: "Fianarantsoa", feeMga: 25000, etaDaysMin: 3, etaDaysMax: 5 },
  { name: "Mahajanga", region: "Boeny", city: "Mahajanga", feeMga: 30000, etaDaysMin: 3, etaDaysMax: 5 },
  { name: "Toliara", region: "Atsimo-Andrefana", city: "Toliara", feeMga: 35000, etaDaysMin: 4, etaDaysMax: 6 },
  { name: "Morondava", region: "Menabe", city: "Morondava", feeMga: 35000, etaDaysMin: 4, etaDaysMax: 6 },
  { name: "Antsiranana", region: "Diana", city: "Antsiranana", feeMga: 40000, etaDaysMin: 4, etaDaysMax: 7 },
  { name: "Nosy Be", region: "Diana", city: "Nosy Be", feeMga: 45000, etaDaysMin: 5, etaDaysMax: 8 },
];

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

async function seedCatalog() {
  let categoryCount = 0;
  let productCount = 0;
  let variantCount = 0;

  for (const [categoryIndex, category] of CATALOG.entries()) {
    const savedCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        nameFr: category.nameFr,
        nameMg: category.nameMg,
        descriptionFr: category.descriptionFr,
        descriptionMg: category.descriptionMg,
        sortOrder: categoryIndex,
        isActive: true,
      },
      create: {
        slug: category.slug,
        nameFr: category.nameFr,
        nameMg: category.nameMg,
        descriptionFr: category.descriptionFr,
        descriptionMg: category.descriptionMg,
        sortOrder: categoryIndex,
      },
    });
    categoryCount += 1;

    for (const [productIndex, product] of category.products.entries()) {
      const savedProduct = await prisma.product.upsert({
        where: { slug: product.slug },
        update: {
          categoryId: savedCategory.id,
          nameFr: product.nameFr,
          nameMg: product.nameMg,
          descriptionFr: product.descriptionFr,
          descriptionMg: product.descriptionMg,
          basePriceMga: product.basePriceMga,
          leadTimeDays: product.leadTimeDays,
          isFeatured: product.isFeatured ?? false,
          sortOrder: productIndex,
          isActive: true,
        },
        create: {
          slug: product.slug,
          categoryId: savedCategory.id,
          nameFr: product.nameFr,
          nameMg: product.nameMg,
          descriptionFr: product.descriptionFr,
          descriptionMg: product.descriptionMg,
          basePriceMga: product.basePriceMga,
          leadTimeDays: product.leadTimeDays,
          isFeatured: product.isFeatured ?? false,
          sortOrder: productIndex,
        },
      });
      productCount += 1;

      for (const [variantIndex, variant] of product.variants.entries()) {
        await prisma.productVariant.upsert({
          where: { sku: variant.sku },
          update: {
            productId: savedProduct.id,
            label: variant.label,
            widthMm: variant.widthMm,
            heightMm: variant.heightMm,
            priceMga: variant.priceMga,
            isDefault: variant.isDefault,
            sortOrder: variant.sortOrder ?? variantIndex,
            isActive: true,
          },
          create: {
            productId: savedProduct.id,
            sku: variant.sku,
            label: variant.label,
            widthMm: variant.widthMm,
            heightMm: variant.heightMm,
            priceMga: variant.priceMga,
            isDefault: variant.isDefault,
            sortOrder: variant.sortOrder ?? variantIndex,
          },
        });
        variantCount += 1;
      }

      // Les anciens formats ne sont plus vendus : seules les combinaisons
      // décrites ici (A4, A5, A6, carré × orientation × couverture) restent actives.
      await prisma.productVariant.updateMany({
        where: {
          productId: savedProduct.id,
          sku: { notIn: product.variants.map((variant) => variant.sku) },
        },
        data: { isActive: false },
      });
    }
  }

  // La boutique ne vend plus que le photobook A4 : tout le reste est retiré
  // de la vitrine sans supprimer l'historique des commandes déjà passées.
  await prisma.product.updateMany({
    where: { slug: { not: PHOTOBOOK_SLUG } },
    data: { isActive: false },
  });
  await prisma.category.updateMany({
    where: { slug: { not: PHOTOBOOK_CATEGORY_SLUG } },
    data: { isActive: false },
  });

  console.log(
    `  catalogue : ${categoryCount} catégorie, ${productCount} produit, ${variantCount} formats`,
  );
}

async function seedZones() {
  for (const zone of ZONES) {
    const existing = await prisma.deliveryZone.findFirst({
      where: { name: zone.name, city: zone.city },
    });

    if (existing) {
      await prisma.deliveryZone.update({ where: { id: existing.id }, data: zone });
    } else {
      await prisma.deliveryZone.create({ data: zone });
    }
  }

  console.log(`  livraison : ${ZONES.length} zones`);
}

async function seedUsers() {
  const accounts = [
    {
      email: "admin@myphoto.mg",
      name: "Admin MyPhoto",
      phone: "+261 34 12 345 67",
      password: "Admin1234!",
      role: "ADMIN" as const,
    },
    {
      email: "client@myphoto.mg",
      name: "Rasoa Nomena",
      phone: "+261 32 98 765 43",
      password: "Client1234!",
      role: "CUSTOMER" as const,
    },
  ];

  for (const account of accounts) {
    // On ne réécrit pas le mot de passe à chaque seed : un admin qui l'a
    // changé ne doit pas le voir revenir à la valeur par défaut.
    const existing = await prisma.user.findUnique({ where: { email: account.email } });

    if (existing) {
      await prisma.user.update({
        where: { email: account.email },
        data: { name: account.name, phone: account.phone, role: account.role },
      });
      continue;
    }

    await prisma.user.create({
      data: {
        email: account.email,
        name: account.name,
        phone: account.phone,
        role: account.role,
        passwordHash: await bcrypt.hash(account.password, 10),
      },
    });
  }

  console.log("  comptes   : admin@myphoto.mg / Admin1234!, client@myphoto.mg / Client1234!");
}

async function main() {
  console.log("Seed MyPhoto Mada…");
  await seedCatalog();
  await seedZones();
  await seedUsers();
  console.log(
    `Seed terminé. Tarif : ${PHOTOBOOK_MIN_PAGES} pages = 15 000 Ar, + ${PHOTOBOOK_EXTRA_PAGE_MGA} Ar/page, + couverture solide 5 000 Ar.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
