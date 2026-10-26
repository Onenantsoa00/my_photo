import type { Metadata } from "next";

import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatMga } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { prisma } from "@/lib/prisma";
import {
  createProductAction,
  createVariantAction,
  deleteProductAction,
  deleteVariantAction,
  updateProductAction,
  updateVariantAction,
} from "@/server/actions/admin";

export const metadata: Metadata = {
  title: "Produits",
};

export default async function AdminProductsPage() {
  const locale = await getLocale();
  const t = (
    key: Parameters<typeof translate>[1],
    replacements?: Record<string, string | number>,
  ) => translate(locale, key, replacements);

  const [categories, products] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: {
        category: { select: { nameFr: true, nameMg: true } },
        variants: { orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);

  const categoryName = (product: (typeof products)[number]) =>
    locale === "mg" ? product.category.nameMg : product.category.nameFr;

  return (
    <div>
      <h1 className="section-title">{t("admin.products")}</h1>
      <p className="muted mt-2">{products.length} produits · prix en Ariary</p>

      {/* ------------------------------------------------------ Création */}
      <section className="card mt-6 p-5">
        <h2 className="font-bold">{t("admin.addProduct")}</h2>

        <form action={createProductAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="label text-[11px]" htmlFor="new-nameFr">
              Nom (FR)
            </label>
            <input id="new-nameFr" name="nameFr" required className="input" />
          </div>

          <div>
            <label className="label text-[11px]" htmlFor="new-nameMg">
              Anarana (MG)
            </label>
            <input id="new-nameMg" name="nameMg" className="input" />
          </div>

          <div className="lg:col-span-2">
            <label className="label text-[11px]" htmlFor="new-description">
              {t("admin.description")}
            </label>
            <input id="new-description" name="descriptionFr" className="input" />
          </div>

          <div>
            <label className="label text-[11px]" htmlFor="new-category">
              {t("admin.category")}
            </label>
            <select id="new-category" name="categoryId" className="input">
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {locale === "mg" ? category.nameMg : category.nameFr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-[11px]" htmlFor="new-price">
              {t("admin.basePrice")}
            </label>
            <input
              id="new-price"
              name="basePriceMga"
              type="number"
              min={0}
              step={100}
              required
              className="input"
            />
          </div>

          <div>
            <label className="label text-[11px]" htmlFor="new-lead">
              {t("product.leadTime")}
            </label>
            <input
              id="new-lead"
              name="leadTimeDays"
              type="number"
              min={0}
              max={60}
              defaultValue={2}
              className="input"
            />
          </div>

          <div>
            <label className="label text-[11px]" htmlFor="new-variant">
              {t("admin.variantLabel")}
            </label>
            <input id="new-variant" name="variantLabel" className="input" placeholder="Standard" />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                className="h-4 w-4 accent-brand-600"
              />
              {t("admin.productActive")}
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isFeatured"
                className="h-4 w-4 accent-brand-600"
              />
              {t("home.featuredTitle")}
            </label>

            <button type="submit" className="btn-primary btn-sm ml-auto">
              {t("common.save")}
            </button>
          </div>
        </form>
      </section>

      {/* -------------------------------------------------------- Liste */}
      <div className="mt-6 space-y-5">
        {products.map((product) => (
          <section key={product.id} className="card p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-sand-200 pb-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {product.nameFr}
                  {!product.isActive ? (
                    <span className="badge-neutral ml-2">{t("admin.productInactive")}</span>
                  ) : null}
                </p>
                <p className="muted text-xs">
                  {categoryName(product)} · <span className="font-mono">{product.slug}</span> ·{" "}
                  {product.variants.length} {t("admin.variants").toLowerCase()}
                </p>
              </div>

              <form action={deleteProductAction}>
                <input type="hidden" name="productId" value={product.id} />
                <ConfirmSubmit
                  message={t("admin.deleteConfirm", { name: product.nameFr })}
                  className="btn-outline btn-sm text-accent-600"
                >
                  {t("admin.deleteProduct")}
                </ConfirmSubmit>
              </form>
            </div>

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
                  <div
                    key={variant.id}
                    className="rounded-xl bg-sand-50 p-2 dark:bg-sand-100/70"
                  >
                    <form action={updateVariantAction} className="flex items-end gap-2">
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

                    <form action={deleteVariantAction} className="mt-1.5 text-right">
                      <input type="hidden" name="variantId" value={variant.id} />
                      <ConfirmSubmit
                        message={t("admin.deleteConfirm", { name: variant.label })}
                        className="text-[11px] font-semibold text-accent-600 hover:underline"
                      >
                        {t("admin.deleteVariant")}
                      </ConfirmSubmit>
                    </form>
                  </div>
                ))}
              </div>

              <form
                action={createVariantAction}
                className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-sand-300 p-3"
              >
                <input type="hidden" name="productId" value={product.id} />

                <div className="min-w-40 flex-1">
                  <label className="label text-[11px]" htmlFor={`variant-label-${product.id}`}>
                    {t("admin.variantLabel")}
                  </label>
                  <input
                    id={`variant-label-${product.id}`}
                    name="label"
                    required
                    className="input px-2 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="label text-[11px]" htmlFor={`variant-price-${product.id}`}>
                    {t("admin.basePrice")}
                  </label>
                  <input
                    id={`variant-price-${product.id}`}
                    name="priceMga"
                    type="number"
                    min={0}
                    step={100}
                    required
                    className="input w-28 px-2 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="label text-[11px]" htmlFor={`variant-w-${product.id}`}>
                    L (mm)
                  </label>
                  <input
                    id={`variant-w-${product.id}`}
                    name="widthMm"
                    type="number"
                    min={1}
                    className="input w-20 px-2 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="label text-[11px]" htmlFor={`variant-h-${product.id}`}>
                    H (mm)
                  </label>
                  <input
                    id={`variant-h-${product.id}`}
                    name="heightMm"
                    type="number"
                    min={1}
                    className="input w-20 px-2 py-1.5 text-sm"
                  />
                </div>

                <button type="submit" className="btn-outline btn-sm">
                  {t("admin.addVariant")}
                </button>
              </form>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
