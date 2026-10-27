import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/product-card";
import { ProductPurchasePanel } from "@/components/product-purchase-panel";
import { ProductThumb } from "@/components/product-thumb";
import { Stars } from "@/components/reviews/stars";
import { formatDate, formatMga } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { productionNotices } from "@/lib/notices";
import {
  PHOTOBOOK_BASE_PRICE_MGA,
  PHOTOBOOK_EXTRA_PAGE_MGA,
  PHOTOBOOK_MIN_PAGES,
  PHOTOBOOK_SLUG,
  findCover,
} from "@/lib/photobook";
import { translate, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import {
  categoryDescription,
  categoryName,
  getCategoryBySlug,
  getProductBySlug,
  listProducts,
  productDescription,
  productName,
} from "@/server/catalog";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();

  const product = await getProductBySlug(slug);
  if (product) {
    return { title: productName(product, locale) };
  }

  const category = await getCategoryBySlug(slug);
  if (category) {
    return { title: categoryName(category, locale) };
  }

  return { title: "Introuvable" };
}

export default async function ProductOrCategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  // Une seule route pour /produits/tirages (catégorie) et
  // /produits/tirage-standard (produit) : on essaie le produit d'abord.
  const product = await getProductBySlug(slug);
  if (product) {
    return <ProductDetail product={product} />;
  }

  const category = await getCategoryBySlug(slug);
  if (category) {
    const products = await listProducts({ categorySlug: slug });

    return (
      <div className="container-page py-10">
        <nav className="muted flex items-center gap-2">
          <Link href="/produits" className="hover:text-brand-700">
            {t("products.title")}
          </Link>
          <span>/</span>
          <span className="text-ink-700">{categoryName(category, locale)}</span>
        </nav>

        <header className="mt-4 max-w-2xl">
          <h1 className="section-title">{categoryName(category, locale)}</h1>
          <p className="muted mt-2 text-base">{categoryDescription(category, locale)}</p>
        </header>

        {products.length === 0 ? (
          <p className="muted mt-10">{t("products.empty")}</p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((item) => (
              <ProductCard key={item.id} product={item} locale={locale} />
            ))}
          </div>
        )}
      </div>
    );
  }

  notFound();
}

async function ProductDetail({
  product,
}: {
  product: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;
}) {
  const locale = await getLocale();
  const t = (key: TranslationKey, replacements?: Record<string, string | number>) =>
    translate(locale, key, replacements);
  const name = productName(product, locale);

  const [reviewStats, reviews] = await Promise.all([
    prisma.review.aggregate({
      where: { productId: product.id, isPublished: true },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.review.findMany({
      where: { productId: product.id, isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        customerName: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    }),
  ]);

  const averageRating = reviewStats._avg.rating ?? 0;
  const galleryImages = product.images;
  const mainImage = product.imageUrl ?? galleryImages[0]?.url ?? null;

  const cheapest = product.variants.reduce(
    (min, variant) => Math.min(min, variant.priceMga),
    Number.POSITIVE_INFINITY,
  );
  const isPhotobook = product.slug === PHOTOBOOK_SLUG;

  return (
    <div className="container-page py-10">
      <nav className="muted flex flex-wrap items-center gap-2">
        <Link href="/produits" className="hover:text-brand-700">
          {t("products.title")}
        </Link>
        <span>/</span>
        <Link href={`/produits/${product.category.slug}`} className="hover:text-brand-700">
          {categoryName(product.category, locale)}
        </Link>
        <span>/</span>
        <span className="text-ink-700">{name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="aspect-[4/3] bg-sand-100">
            <ProductThumb
              categorySlug={product.category.slug}
              imageUrl={mainImage}
              label={name}
              locale={locale}
            />
          </div>

          {galleryImages.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 p-3">
              {galleryImages.slice(0, 4).map((image) => (
                <div
                  key={image.id}
                  className="aspect-square overflow-hidden rounded-lg bg-sand-100 ring-1 ring-sand-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.altFr ?? name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 p-3">
              {product.variants.slice(0, 4).map((variant) => (
                <div
                  key={variant.id}
                  className="grid aspect-square place-items-center rounded-lg bg-sand-100 p-1 text-center text-[11px] font-semibold text-ink-700"
                >
                  {variant.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="badge-neutral">{categoryName(product.category, locale)}</span>
          <h1 className="mt-3 text-3xl font-black tracking-tight">{name}</h1>
          <p className="mt-3 leading-relaxed text-ink-700">
            {productDescription(product, locale)}
          </p>

          <p className="mt-4 flex items-center gap-2 text-sm">
            <span className="badge-brand">✓ {t("product.inStock")}</span>
            {Number.isFinite(cheapest) ? (
              <span className="muted">
                {t("common.from")} <strong>{formatMga(cheapest)}</strong>
              </span>
            ) : null}
          </p>

          {/* Ces informations viennent de la base, pas de la mise en page. */}
          <div className="mt-6 border-t border-sand-200 pt-6">
            {isPhotobook ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-brand-900/30">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-brand-700 dark:text-brand-200">
                    A4 · A5 · A6 · Carré · {PHOTOBOOK_MIN_PAGES} pages incluses
                  </p>
                  <p className="mt-2 text-3xl font-black text-brand-800 dark:text-brand-100">
                    {formatMga(PHOTOBOOK_BASE_PRICE_MGA)}
                  </p>
                  <p className="mt-1 text-sm text-ink-700">
                    puis {formatMga(PHOTOBOOK_EXTRA_PAGE_MGA)} par page supplémentaire
                  </p>
                  <p className="mt-1 text-sm text-ink-700">
                    Couverture moyen solide incluse · couverture solide +{" "}
                    {formatMga(findCover("rigide").extraPriceMga)}
                  </p>
                </div>

                <Link
                  href="/creer"
                  className="btn-primary w-full py-3 text-base"
                >
                  <BookOpen className="h-4 w-4" /> Créer mon photobook
                </Link>

                <p className="muted text-xs leading-relaxed">
                  Choisissez le papier, le nombre de pages, l'orientation et la
                  couverture dans l'assistant. Vous pourrez sauvegarder votre brouillon
                  et le reprendre plus tard.
                </p>
              </div>
            ) : (
              <ProductPurchasePanel
                productId={product.id}
                productSlug={product.slug}
                leadTimeDays={product.leadTimeDays}
                variants={product.variants.map((variant) => ({
                  id: variant.id,
                  label: variant.label,
                  priceMga: variant.priceMga,
                  widthMm: variant.widthMm,
                  heightMm: variant.heightMm,
                  isDefault: variant.isDefault,
                }))}
              />
            )}
          </div>

          <div className="mt-6 rounded-xl bg-sand-100 p-4">
            <h2 className="text-sm font-bold">{t("product.description")}</h2>
            <ul className="muted mt-2 space-y-1">
              {productionNotices(locale).map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- Avis */}
      <section id="avis" className="mt-12 scroll-mt-24 border-t border-sand-200 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-black tracking-tight">{t("review.summary")}</h2>
            <p className="muted mt-1 text-sm">{t("home.reviewsSubtitle")}</p>
          </div>

          {reviewStats._count > 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
              <span className="text-3xl font-black text-amber-900 dark:text-amber-100">
                {averageRating.toFixed(1)}
              </span>
              <div>
                <Stars value={averageRating} />
                <p className="mt-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                  {t("review.count", { count: reviewStats._count })}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {reviews.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <article key={review.id} className="card p-4">
                <Stars value={review.rating} size="sm" />
                <p className="mt-2 text-sm leading-relaxed text-ink-700">
                  {review.comment ?? t("review.verified")}
                </p>
                <p className="mt-3 border-t border-sand-200 pt-2 text-[11px] text-ink-500">
                  <strong className="text-ink-700">{review.customerName}</strong> ·{" "}
                  {t("review.verified")} ·{" "}
                  {formatDate(review.createdAt, locale === "mg" ? "fr-MG" : "fr-FR")}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="card mt-5 flex flex-wrap items-center gap-4 p-5">
            <Stars value={0} size="lg" />
            <p className="muted min-w-0 flex-1 text-sm">{t("review.empty")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
