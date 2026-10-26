import bcrypt from "bcryptjs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  PHOTOBOOK_PAGES,
  PHOTOBOOK_SLUG,
  photobookVariantSeeds,
} from "../src/lib/photobook";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL manquant : impossible de seeder la base.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

type VariantSeed = {
  label: string;
  priceMga: number;
  widthMm?: number;
  heightMm?: number;
  isDefault?: boolean;
  /**
   * Référence explicite. Les formats de photobook en ont besoin : elle est
   * calculée par `src/lib/photobook.ts` et retrouvée par l'assistant `/creer`.
   * Sans elle, le SKU reste dérivé du rang du format.
   */
  sku?: string;
  sortOrder?: number;
};

type ProductSeed = {
  slug: string;
  nameFr: string;
  nameMg: string;
  descriptionFr: string;
  descriptionMg: string;
  basePriceMga: number;
  leadTimeDays: number;
  isFeatured?: boolean;
  variants: VariantSeed[];
};

type CategorySeed = {
  slug: string;
  nameFr: string;
  nameMg: string;
  descriptionFr: string;
  descriptionMg: string;
  products: ProductSeed[];
};

const CATALOG: CategorySeed[] = [
  {
    slug: "tirages",
    nameFr: "Tirages photo",
    nameMg: "Sary pirinty",
    descriptionFr:
      "Vos photos sur papier photo brillant ou satiné, découpées au format exact.",
    descriptionMg:
      "Ny sarinao amin'ny taratasy mazava na satiné, voatapaka amin'ny habe marina.",
    products: [
      {
        slug: "tirage-standard",
        nameFr: "Tirage photo standard",
        nameMg: "Sary pirinty mahazatra",
        descriptionFr:
          "Papier photo 200 g/m² brillant. Idéal pour les albums et les cadres.",
        descriptionMg:
          "Taratasy sary 200 g/m² mazava. Tsara ho an'ny rakitsary sy ny fefy.",
        basePriceMga: 800,
        leadTimeDays: 1,
        isFeatured: true,
        variants: [
          { label: "10 × 15 cm", widthMm: 100, heightMm: 150, priceMga: 800, isDefault: true },
          { label: "13 × 18 cm", widthMm: 130, heightMm: 180, priceMga: 1500 },
          { label: "15 × 21 cm", widthMm: 150, heightMm: 210, priceMga: 2500 },
          { label: "20 × 30 cm", widthMm: 200, heightMm: 300, priceMga: 5000 },
          { label: "30 × 45 cm", widthMm: 300, heightMm: 450, priceMga: 12000 },
        ],
      },
      {
        slug: "tirage-satine-premium",
        nameFr: "Tirage premium satiné",
        nameMg: "Sary pirinty satiné ambony",
        descriptionFr:
          "Papier fine art 260 g/m² satiné, encres pigmentaires. Rendus de peau naturels.",
        descriptionMg:
          "Taratasy fine art 260 g/m² satiné, ranomainty pigmentaire. Voajanahary ny lokon'ny hoditra.",
        basePriceMga: 12000,
        leadTimeDays: 2,
        isFeatured: true,
        variants: [
          { label: "A5", widthMm: 148, heightMm: 210, priceMga: 6000, isDefault: true },
          { label: "A4", widthMm: 210, heightMm: 297, priceMga: 12000 },
          { label: "A3", widthMm: 297, heightMm: 420, priceMga: 26000 },
        ],
      },
    ],
  },
  {
    slug: "cadres",
    nameFr: "Cadres & tableaux",
    nameMg: "Fefy sy tabilao",
    descriptionFr: "Tirages encadrés, prêts à accrocher au mur.",
    descriptionMg: "Sary misy fefy, vonona hapetaka amin'ny rindrina.",
    products: [
      {
        slug: "cadre-bois",
        nameFr: "Cadre photo en bois",
        nameMg: "Fefy hazo",
        descriptionFr:
          "Cadre en bois clair avec passe-partout blanc, verre de protection inclus.",
        descriptionMg:
          "Fefy hazo mazava misy passe-partout fotsy, misy fitaratra miaro.",
        basePriceMga: 45000,
        leadTimeDays: 3,
        variants: [
          { label: "13 × 18 cm", widthMm: 130, heightMm: 180, priceMga: 45000, isDefault: true },
          { label: "A4", widthMm: 210, heightMm: 297, priceMga: 68000 },
          { label: "20 × 30 cm", widthMm: 200, heightMm: 300, priceMga: 82000 },
          { label: "30 × 40 cm", widthMm: 300, heightMm: 400, priceMga: 130000 },
        ],
      },
      {
        slug: "tableau-toile",
        nameFr: "Tableau sur toile",
        nameMg: "Tabilao lamba",
        descriptionFr:
          "Impression sur toile tendue sur châssis bois, sans verre. Effet galerie.",
        descriptionMg:
          "Sary pirinty amin'ny lamba voatanty amin'ny chassis hazo, tsy misy fitaratra.",
        basePriceMga: 98000,
        leadTimeDays: 4,
        variants: [
          { label: "30 × 40 cm", widthMm: 300, heightMm: 400, priceMga: 98000, isDefault: true },
          { label: "40 × 60 cm", widthMm: 400, heightMm: 600, priceMga: 165000 },
          { label: "50 × 70 cm", widthMm: 500, heightMm: 700, priceMga: 245000 },
        ],
      },
    ],
  },
  {
    slug: "albums",
    nameFr: "Albums photo",
    nameMg: "Rakitsary",
    descriptionFr: "Albums reliés, feuilles épaisses et couverture personnalisée.",
    descriptionMg: "Rakitsary voafatotra, ravina matevina sy fonony voasoratra anarana.",
    products: [
      {
        slug: "album-photo",
        nameFr: "Album photo relié",
        nameMg: "Rakitsary voafatotra",
        descriptionFr:
          "Couverture rigide imprimée, 20 pages épaisses 300 g/m², reliure cousue.",
        descriptionMg:
          "Fonony mafy pirinty, 20 pejy matevina 300 g/m², voaisy fanjaitra.",
        basePriceMga: 120000,
        leadTimeDays: 5,
        variants: [
          { label: "20 × 20 cm — 20 pages", widthMm: 200, heightMm: 200, priceMga: 120000, isDefault: true },
          { label: "28 × 28 cm — 20 pages", widthMm: 280, heightMm: 280, priceMga: 185000 },
          { label: "30 × 30 cm — 30 pages", widthMm: 300, heightMm: 300, priceMga: 235000 },
        ],
      },
      {
        slug: PHOTOBOOK_SLUG,
        nameFr: "Photobook A4 / A3",
        nameMg: "Photobook A4 / A3",
        descriptionFr: `Album relié imprimé page par page : ${PHOTOBOOK_PAGES} pages, couverture solide ou moyen solide, en A5, A4, A3 ou carré, portrait ou paysage.`,
        descriptionMg: `Rakitsary voafatotra pirinty isaky ny pejy : ${PHOTOBOOK_PAGES} pejy, fonony mafy na semi-rigide, A5, A4, A3 na efajoro, mitsangana na mandry.`,
        basePriceMga: 75_000,
        leadTimeDays: 5,
        isFeatured: true,
        // 20 combinaisons papier × orientation × couverture, générées depuis la
        // même source que l'assistant de création (src/lib/photobook.ts).
        variants: photobookVariantSeeds(),
      },
      {
        slug: "album-mariage",
        nameFr: "Album de mariage",
        nameMg: "Rakitsary fampakaram-bady",
        descriptionFr:
          "Album premium, papier satiné 400 g/m², 40 pages. Livré en boîte cadeau.",
        descriptionMg:
          "Rakitsary ambony, taratasy satiné 400 g/m², 40 pejy. Misy boaty fanomezana.",
        basePriceMga: 380000,
        leadTimeDays: 7,
        variants: [
          { label: "30 × 30 cm — 40 pages", widthMm: 300, heightMm: 300, priceMga: 380000, isDefault: true },
          { label: "35 × 35 cm — 40 pages", widthMm: 350, heightMm: 350, priceMga: 520000 },
        ],
      },
    ],
  },
  {
    slug: "objets",
    nameFr: "Objets personnalisés",
    nameMg: "Zavatra voasoratra anarana",
    descriptionFr: "Mugs, t-shirts, puzzles et coussins imprimés à votre image.",
    descriptionMg: "Kapoaka, t-shirt, puzzle sy ondana voasary pirinty.",
    products: [
      {
        slug: "mug-personnalise",
        nameFr: "Mug personnalisé",
        nameMg: "Kapoaka voasoratra anarana",
        descriptionFr: "Mug céramique 325 ml, impression sublimation lavable au lave-vaisselle.",
        descriptionMg: "Kapoaka céramique 325 ml, pirinty sublimation azo sasana.",
        basePriceMga: 35000,
        leadTimeDays: 2,
        isFeatured: true,
        variants: [
          { label: "Mug 325 ml blanc", priceMga: 35000, isDefault: true },
          { label: "Mug magique (révélable)", priceMga: 48000 },
          { label: "Mug intérieur coloré", priceMga: 42000 },
        ],
      },
      {
        slug: "t-shirt-personnalise",
        nameFr: "T-shirt personnalisé",
        nameMg: "T-shirt voasoratra anarana",
        descriptionFr: "Coton 180 g/m², impression numérique durable, tailles S à XXL.",
        descriptionMg: "Coton 180 g/m², pirinty maharitra, habe S ka hatramin'ny XXL.",
        basePriceMga: 55000,
        leadTimeDays: 3,
        variants: [
          { label: "Taille S", priceMga: 55000, isDefault: true },
          { label: "Taille M", priceMga: 55000 },
          { label: "Taille L", priceMga: 58000 },
          { label: "Taille XL", priceMga: 62000 },
          { label: "Taille XXL", priceMga: 68000 },
        ],
      },
      {
        slug: "puzzle-photo",
        nameFr: "Puzzle photo",
        nameMg: "Puzzle sary",
        descriptionFr: "Puzzle 300 pièces dans une boîte cadeau, à partir de votre photo.",
        descriptionMg: "Puzzle 300 pièces anaty boaty fanomezana, avy amin'ny sarinao.",
        basePriceMga: 65000,
        leadTimeDays: 4,
        variants: [
          { label: "300 pièces — A4", widthMm: 210, heightMm: 297, priceMga: 65000, isDefault: true },
          { label: "500 pièces — A3", widthMm: 297, heightMm: 420, priceMga: 95000 },
        ],
      },
      {
        slug: "coussin-photo",
        nameFr: "Coussin photo",
        nameMg: "Ondana sary",
        descriptionFr: "Housse polyester 40 × 40 cm avec garnissage inclus.",
        descriptionMg: "Sarony polyester 40 × 40 cm misy famenoana.",
        basePriceMga: 70000,
        leadTimeDays: 4,
        variants: [
          { label: "40 × 40 cm", widthMm: 400, heightMm: 400, priceMga: 70000, isDefault: true },
          { label: "50 × 50 cm", widthMm: 500, heightMm: 500, priceMga: 95000 },
        ],
      },
    ],
  },
  {
    slug: "cartes",
    nameFr: "Cartes & faire-part",
    nameMg: "Karatra sy fanasana",
    descriptionFr: "Cartes postales, vœux et faire-part de mariage ou de naissance.",
    descriptionMg: "Karatra, fiarahabana sy fanasana fampakaram-bady na fahaterahana.",
    products: [
      {
        slug: "carte-postale",
        nameFr: "Carte postale",
        nameMg: "Karatra",
        descriptionFr: "Carte 350 g/m² avec dos vierge pour écrire. Vendue à l'unité.",
        descriptionMg: "Karatra 350 g/m² misy lamosina foana hanoratana. Isam-batan'olona.",
        basePriceMga: 1500,
        leadTimeDays: 2,
        variants: [
          { label: "A6 — 10 × 15 cm", widthMm: 100, heightMm: 150, priceMga: 1500, isDefault: true },
          { label: "A5 — 15 × 21 cm", widthMm: 150, heightMm: 210, priceMga: 3000 },
        ],
      },
      {
        slug: "faire-part-mariage",
        nameFr: "Faire-part de mariage",
        nameMg: "Fanasana fampakaram-bady",
        descriptionFr:
          "Faire-part double volet avec enveloppe. Tarif dégressif à partir de 50 pièces.",
        descriptionMg:
          "Fanasana roa sosona misy valopy. Mihena ny vidiny manomboka amin'ny 50.",
        basePriceMga: 2500,
        leadTimeDays: 5,
        variants: [
          { label: "10 × 21 cm — à l'unité", widthMm: 100, heightMm: 210, priceMga: 2500, isDefault: true },
          { label: "10 × 21 cm — lot de 50", widthMm: 100, heightMm: 210, priceMga: 95000 },
          { label: "10 × 21 cm — lot de 100", widthMm: 100, heightMm: 210, priceMga: 165000 },
        ],
      },
    ],
  },
  {
    slug: "affiches",
    nameFr: "Affiches & posters",
    nameMg: "Afisy sy poster",
    descriptionFr: "Grands formats pour la décoration intérieure et les événements.",
    descriptionMg: "Habe lehibe ho haingo trano sy hetsika.",
    products: [
      {
        slug: "poster-mural",
        nameFr: "Poster mural",
        nameMg: "Poster rindrina",
        descriptionFr: "Papier mat 200 g/m², sans cadre. Idéal pour habiller un mur.",
        descriptionMg: "Taratasy mat 200 g/m², tsy misy fefy. Tsara ho haingo rindrina.",
        basePriceMga: 18000,
        leadTimeDays: 2,
        isFeatured: true,
        variants: [
          { label: "A3", widthMm: 297, heightMm: 420, priceMga: 18000, isDefault: true },
          { label: "A2", widthMm: 420, heightMm: 594, priceMga: 35000 },
          { label: "A1", widthMm: 594, heightMm: 841, priceMga: 62000 },
          { label: "A0", widthMm: 841, heightMm: 1189, priceMga: 110000 },
        ],
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
        const sku = variant.sku ?? `${product.slug}-${variantIndex + 1}`;

        await prisma.productVariant.upsert({
          where: { sku },
          update: {
            productId: savedProduct.id,
            label: variant.label,
            widthMm: variant.widthMm ?? null,
            heightMm: variant.heightMm ?? null,
            priceMga: variant.priceMga,
            isDefault: variant.isDefault ?? false,
            sortOrder: variant.sortOrder ?? variantIndex,
            isActive: true,
          },
          create: {
            productId: savedProduct.id,
            sku,
            label: variant.label,
            widthMm: variant.widthMm ?? null,
            heightMm: variant.heightMm ?? null,
            priceMga: variant.priceMga,
            isDefault: variant.isDefault ?? false,
            sortOrder: variant.sortOrder ?? variantIndex,
          },
        });
        variantCount += 1;
      }
    }
  }

  console.log(
    `  catalogue : ${categoryCount} catégories, ${productCount} produits, ${variantCount} formats`,
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
  console.log("Seed terminé.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
