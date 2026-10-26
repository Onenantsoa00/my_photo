import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { categoryName, listCategories, listProducts } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Nos produits",
};

export default async function ProductsPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const [categories, products] = await Promise.all([listCategories(), listProducts()]);

  return (
    <div className="container-page py-10">
      <header className="max-w-2xl">
        <h1 className="section-title">{t("products.title")}</h1>
        <p className="muted mt-2 text-base">{t("products.subtitle")}</p>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2">
        <span className="badge-brand">{t("products.all")}</span>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/produits/${category.slug}`}
            className="badge-neutral hover:bg-brand-50 hover:text-brand-800"
          >
            {categoryName(category, locale)}
            <span className="text-ink-500">· {category._count.products}</span>
          </Link>
        ))}
      </nav>

      {products.length === 0 ? (
        <p className="muted mt-10">{t("products.empty")}</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
