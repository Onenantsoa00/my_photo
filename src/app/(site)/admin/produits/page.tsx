import type { Metadata } from "next";

import { formatMga } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { prisma } from "@/lib/prisma";
import { updateProductAction, updateVariantAction } from "@/server/actions/admin";

export const metadata: Metadata = {
  title: "Produits",
};

export default async function AdminProductsPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const products = await prisma.product.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: {
      category: { select: { nameFr: true, nameMg: true } },
      variants: { orderBy: { sortOrder: "asc" } },
    },
  });

  return (
    <div>
      <h1 className="section-title">{t("admin.products")}</h1>
      <p className="muted mt-2">{products.length} produits · prix en Ariary</p>

      <div className="mt-6 space-y-5">
        {products.map((product) => (
          <section key={product.id} className="card p-5">
            <form action={updateProductAction} className="grid gap-4 lg:grid-cols-4">
              <input type="hidden" name="productId" value={product.id} />

              <div className="lg:col-span-2">
                <label className="label text-[11px]" htmlFor={`nameFr-${product.id}`}>
                  Nom (FR)
                </label>
                <input
                  id={`nameFr-${product.id}`}
                  name="nameFr"
                  className="input"
                  defaultValue={product.nameFr}
                />
                <p className="muted mt-1 text-xs">
                  {locale === "mg" ? product.category.nameMg : product.category.nameFr} ·{" "}
                  <span className="font-mono">{product.slug}</span>
                </p>
              </div>

              <div>
                <label className="label text-[11px]" htmlFor={`nameMg-${product.id}`}>
                  Anarana (MG)
                </label>
                <input
                  id={`nameMg-${product.id}`}
                  name="nameMg"
                  className="input"
                  defaultValue={product.nameMg}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-[11px]" htmlFor={`basePrice-${product.id}`}>
                    {t("admin.basePrice")}
                  </label>
                  <input
                    id={`basePrice-${product.id}`}
                    name="basePriceMga"
                    type="number"
                    min={0}
                    step={100}
                    className="input"
                    defaultValue={product.basePriceMga}
                  />
                </div>
                <div>
                  <label className="label text-[11px]" htmlFor={`leadTime-${product.id}`}>
                    {t("product.leadTime")}
                  </label>
                  <input
                    id={`leadTime-${product.id}`}
                    name="leadTimeDays"
                    type="number"
                    min={0}
                    max={60}
                    className="input"
                    defaultValue={product.leadTimeDays}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 lg:col-span-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={product.isActive}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {t("admin.productActive")}
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    defaultChecked={product.isFeatured}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {t("home.featuredTitle")}
                </label>

                <button type="submit" className="btn-primary btn-sm ml-auto">
                  {t("common.save")}
                </button>
              </div>
            </form>

            <div className="mt-5 border-t border-sand-200 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500">
                {t("admin.variants")} ({product.variants.length})
              </h3>

              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {product.variants.map((variant) => (
                  <form
                    key={variant.id}
                    action={updateVariantAction}
                    className="flex items-end gap-2 rounded-xl bg-sand-50 p-2"
                  >
                    <input type="hidden" name="variantId" value={variant.id} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{variant.label}</p>
                      <p className="muted text-[10px]">
                        {variant.sku} · {formatMga(variant.priceMga)}
                      </p>
                    </div>

                    <input
                      name="priceMga"
                      type="number"
                      min={0}
                      step={100}
                      defaultValue={variant.priceMga}
                      aria-label={t("admin.basePrice")}
                      className="input w-24 px-2 py-1 text-xs"
                    />

                    <label className="flex items-center gap-1 pb-1.5">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={variant.isActive}
                        className="h-3.5 w-3.5 accent-brand-600"
                      />
                      <span className="text-[10px] text-ink-500">OK</span>
                    </label>

                    <button type="submit" className="btn-outline btn-sm">
                      {t("common.save")}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
