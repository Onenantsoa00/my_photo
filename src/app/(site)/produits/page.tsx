import type { Metadata } from "next";
import { BookOpen, Check, Sparkles } from "lucide-react";
import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion/reveal";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import {
  PHOTOBOOK_BASE_PRICE_MGA,
  PHOTOBOOK_EXTRA_PAGE_MGA,
  PHOTOBOOK_MIN_PAGES,
} from "@/lib/photobook";
import { formatMga } from "@/lib/format";
import {
  categoryDescription,
  categoryName,
  listCategories,
  listProducts,
} from "@/server/catalog";

export const metadata: Metadata = {
  title: "Le photobook",
};

export default async function ProductsPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const [categories, products] = await Promise.all([listCategories(), listProducts()]);

  // Chaque type de produit a sa propre section : la boutique peut grandir sans
  // que le client ait à filtrer une liste indifférenciée.
  const groups = categories
    .map((category) => ({
      category,
      items: products.filter((product) => product.category.slug === category.slug),
    }))
    .filter((group) => group.items.length > 0);

  const knownSlugs = new Set(categories.map((category) => category.slug));
  const others = products.filter((product) => !knownSlugs.has(product.category.slug));

  return (
    <div>
      <section className="border-b border-sand-200 bg-card">
        <div className="container-page grid gap-8 py-12 lg:grid-cols-[1.2fr_.8fr] lg:items-center lg:py-16">
          <Reveal>
            <span className="badge-brand inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> A4 · A5 · A6 · Carré · {PHOTOBOOK_MIN_PAGES}{" "}
              pages minimum
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              {t("products.title")}
            </h1>
            <p className="muted mt-3 max-w-xl text-base leading-relaxed">
              {t("products.subtitle")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/creer" className="btn-primary px-5 py-3 text-sm">
                <BookOpen className="h-4 w-4" /> {t("home.heroCta")}
              </Link>
              <Link href="#prix" className="btn-outline px-5 py-3 text-sm">
                {t("wizard.price")}
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div id="prix" className="rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-800 dark:bg-brand-900/30">
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-700 dark:text-brand-200">
                {t("wizard.price")}
              </p>
              <p className="mt-2 text-3xl font-black text-brand-800 dark:text-brand-100">
                {formatMga(PHOTOBOOK_BASE_PRICE_MGA)}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {PHOTOBOOK_MIN_PAGES} {t("editor.pagesShort")} · puis{" "}
                {formatMga(PHOTOBOOK_EXTRA_PAGE_MGA)} / {t("editor.page").toLowerCase()}
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-ink-700">
                {[
                  "Papier A4, A5, A6 ou carré — portrait ou paysage",
                  "Couverture solide (+ 5 000 Ar) ou moyen solide",
                  "Impression 300 dpi",
                  "Brouillon enregistré automatiquement",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container-page py-12">
        {categories.length > 0 ? (
          <nav className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">
              {t("products.types")}
            </span>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`#${category.slug}`}
                className="badge-neutral hover:bg-brand-50 hover:text-brand-800"
              >
                {categoryName(category, locale)}
                <span className="text-ink-500">· {category._count.products}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        {products.length === 0 ? (
          <p className="muted mt-10">{t("products.empty")}</p>
        ) : (
          <div className="mt-8 space-y-14">
            {groups.map((group) => (
              <section
                key={group.category.id}
                id={group.category.slug}
                className="scroll-mt-24"
              >
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-sand-200 pb-3">
                  <div>
                    <h2 className="text-xl font-black tracking-tight sm:text-2xl">
                      {categoryName(group.category, locale)}
                    </h2>
                    <p className="muted mt-1 max-w-2xl text-sm leading-relaxed">
                      {categoryDescription(group.category, locale)}
                    </p>
                  </div>
                  <span className="badge-neutral">
                    {group.items.length} {t("nav.photobooks").toLowerCase()}
                  </span>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((product) => (
                    <ProductCard key={product.id} product={product} locale={locale} />
                  ))}
                </div>
              </section>
            ))}

            {others.length > 0 ? (
              <section id="autres" className="scroll-mt-24">
                <div className="border-b border-sand-200 pb-3">
                  <h2 className="text-xl font-black tracking-tight sm:text-2xl">
                    {t("products.all")}
                  </h2>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {others.map((product) => (
                    <ProductCard key={product.id} product={product} locale={locale} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
