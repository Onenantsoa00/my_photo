import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { ProductThumb } from "@/components/product-thumb";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { categoryName, listCategories, listFeaturedProducts } from "@/server/catalog";

export default async function HomePage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const [categories, featured] = await Promise.all([
    listCategories(),
    listFeaturedProducts(4),
  ]);

  const steps = [
    { title: t("home.howStep1Title"), text: t("home.howStep1Text"), icon: "🎨" },
    { title: t("home.howStep2Title"), text: t("home.howStep2Text"), icon: "🖼️" },
    { title: t("home.howStep3Title"), text: t("home.howStep3Text"), icon: "🚚" },
  ];

  const arguments_ = [
    { title: t("home.paymentTitle"), text: t("home.paymentText"), icon: "📱" },
    { title: t("home.localTitle"), text: t("home.localText"), icon: "🇲🇬" },
    { title: t("home.printQualityTitle"), text: t("home.printQualityText"), icon: "🖨️" },
  ];

  return (
    <div>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-sand-200 bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-100 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-accent-100 blur-3xl"
        />

        <div className="container-page relative grid gap-10 py-14 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <span className="badge-brand">{t("home.heroBadge")}</span>
            <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight text-ink-900 sm:text-5xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-700">
              {t("home.heroSubtitle")}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/creer" className="btn-primary px-6 py-3 text-base">
                {t("home.heroCta")}
              </Link>
              <Link href="/produits" className="btn-outline px-6 py-3 text-base">
                {t("home.heroSecondary")}
              </Link>
            </div>

            <dl className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-sand-200 pt-6">
              <div>
                <dt className="muted">Formats</dt>
                <dd className="text-xl font-bold text-brand-700">24</dd>
              </div>
              <div>
                <dt className="muted">Régions livrées</dt>
                <dd className="text-xl font-bold text-brand-700">22</dd>
              </div>
              <div>
                <dt className="muted">Production</dt>
                <dd className="text-xl font-bold text-brand-700">300 dpi</dd>
              </div>
            </dl>
          </div>

          {/* Aperçu décoratif de l'atelier */}
          <div className="relative">
            <div className="card overflow-hidden p-3 shadow-lg">
              <div className="flex items-center gap-1.5 px-1 pb-2">
                <span className="h-2.5 w-2.5 rounded-full bg-accent-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-brand-400" />
                <span className="muted ml-2 text-xs">{t("editor.canvas")}</span>
              </div>
              <div className="grid aspect-[3/2] grid-cols-3 gap-2 rounded-xl bg-sand-100 p-3">
                <div className="overflow-hidden rounded-lg bg-gradient-to-br from-sky-200 to-sky-400" />
                <div className="overflow-hidden rounded-lg bg-gradient-to-br from-emerald-200 to-emerald-400" />
                <div className="overflow-hidden rounded-lg bg-gradient-to-br from-orange-200 to-orange-400" />
                <div className="col-span-3 flex items-center justify-center rounded-lg bg-white shadow-inner">
                  <span className="px-4 text-center text-lg font-black text-brand-700 sm:text-2xl">
                    Fahatsiarovana 2026
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Catégories */}
      <section className="container-page py-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="section-title">{t("home.categoriesTitle")}</h2>
          <Link href="/produits" className="text-sm font-semibold text-brand-700 hover:underline">
            {t("products.title")} →
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/produits/${category.slug}`}
              className="card group flex items-center gap-4 p-4 transition-shadow hover:shadow-md"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <ProductThumb
                  categorySlug={category.slug}
                  imageUrl={category.imageUrl}
                  label={categoryName(category, locale)}
                  locale={locale}
                />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-semibold group-hover:text-brand-700">
                  {categoryName(category, locale)}
                </h3>
                <p className="muted">
                  {category._count.products}{" "}
                  {translate(
                    locale,
                    category._count.products > 1
                      ? "products.productCountPlural"
                      : "products.productCount",
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- Vedettes */}
      {featured.length > 0 ? (
        <section className="border-y border-sand-200 bg-white py-14">
          <div className="container-page">
            <h2 className="section-title">{t("home.featuredTitle")}</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------ Comment ça marche */}
      <section className="container-page py-14">
        <h2 className="section-title text-center">{t("home.howTitle")}</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="card p-6">
              <span className="text-3xl" aria-hidden>
                {step.icon}
              </span>
              <h3 className="mt-3 font-bold">{step.title}</h3>
              <p className="muted mt-1 leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- Arguments */}
      <section className="border-t border-sand-200 bg-white py-14">
        <div className="container-page grid gap-5 sm:grid-cols-3">
          {arguments_.map((item) => (
            <div key={item.title} className="rounded-2xl bg-sand-50 p-6">
              <span className="text-3xl" aria-hidden>
                {item.icon}
              </span>
              <h3 className="mt-3 font-bold">{item.title}</h3>
              <p className="muted mt-1 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
