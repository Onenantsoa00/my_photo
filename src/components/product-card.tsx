import Link from "next/link";

import { ProductThumb } from "@/components/product-thumb";
import { formatMga } from "@/lib/format";
import { translate, type Locale } from "@/lib/i18n";
import { categoryName, lowestPrice, productName } from "@/server/catalog";

type ProductCardProduct = {
  slug: string;
  nameFr: string;
  nameMg: string;
  descriptionFr: string;
  descriptionMg: string | null;
  imageUrl: string | null;
  images?: { url: string }[];
  variants: { priceMga: number }[];
  category: { slug: string; nameFr: string; nameMg: string };
};

export function ProductCard({
  product,
  locale,
}: {
  product: ProductCardProduct;
  locale: Locale;
}) {
  const name = productName(product, locale);
  const from = lowestPrice(product.variants);

  return (
    <Link
      href={`/produits/${product.slug}`}
      className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sand-100">
        <ProductThumb
          categorySlug={product.category.slug}
          imageUrl={product.imageUrl ?? product.images?.[0]?.url ?? null}
          label={name}
          locale={locale}
          className="transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-bold text-ink-700 shadow-sm backdrop-blur">
          {categoryName(product.category, locale)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold leading-snug text-ink-900">{name}</h3>
        <p className="muted mt-1 line-clamp-2">
          {locale === "mg"
            ? (product.descriptionMg ?? product.descriptionFr)
            : product.descriptionFr}
        </p>

        <div className="mt-4 flex items-end justify-between border-t border-sand-200 pt-3">
          <div>
            {from !== null ? (
              <>
                <span className="text-[11px] uppercase tracking-wide text-ink-500">
                  {translate(locale, "common.from")}
                </span>
                <p className="text-lg font-bold text-brand-700">{formatMga(from)}</p>
              </>
            ) : (
              <p className="text-sm text-ink-500">—</p>
            )}
          </div>
          <span className="text-sm font-semibold text-brand-600 group-hover:underline">
            {translate(locale, "products.view")} →
          </span>
        </div>
      </div>
    </Link>
  );
}
