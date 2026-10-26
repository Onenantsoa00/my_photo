import type { Metadata } from "next";
import Link from "next/link";

import { ProductThumb } from "@/components/product-thumb";
import { formatMga } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { getCartDetail } from "@/server/cart";
import { storageUrl } from "@/lib/storage-url";
import { removeCartItemAction, updateCartItemAction } from "@/server/actions/cart";

export const metadata: Metadata = {
  title: "Mon panier",
};

export default async function CartPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1], replacements?: Record<string, string | number>) =>
    translate(locale, key, replacements);

  const cart = await getCartDetail();

  return (
    <div className="container-page py-10">
      <h1 className="section-title">{t("cart.title")}</h1>

      {cart.items.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-base text-ink-700">{t("cart.empty")}</p>
          <Link href="/produits" className="btn-primary mt-4">
            {t("cart.continue")}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <ul className="space-y-3">
            {cart.items.map((item) => {
              const preview = storageUrl(item.previewPath);
              const name = locale === "mg" ? item.productNameMg : item.productNameFr;

              return (
                <li key={item.id} className="card flex gap-4 p-3">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sand-100">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview}
                        alt={item.designTitle ?? name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ProductThumb
                        categorySlug={item.categorySlug}
                        label={name}
                        locale={locale}
                      />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/produits/${item.productSlug}`}
                          className="font-semibold hover:text-brand-700"
                        >
                          {name}
                        </Link>
                        <p className="muted">
                          {item.variantLabel}
                          {item.pageCount ? ` · ${item.pageCount} pages` : null}
                        </p>
                        {item.designTitle ? (
                          <p className="mt-1 text-xs font-semibold text-brand-700">
                            🎨 {t("cart.design")} : {item.designTitle}
                          </p>
                        ) : null}
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-brand-700">
                          {formatMga(item.lineTotalMga)}
                        </p>
                        <p className="muted text-xs">
                          {formatMga(item.unitPriceMga)} / {t("common.quantity").toLowerCase()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap items-end gap-3 pt-3">
                      <form action={updateCartItemAction} className="flex items-end gap-2">
                        <input type="hidden" name="itemId" value={item.id} />
                        <div>
                          <label
                            className="label text-[11px]"
                            htmlFor={`quantity-${item.id}`}
                          >
                            {t("common.quantity")}
                          </label>
                          <input
                            id={`quantity-${item.id}`}
                            name="quantity"
                            type="number"
                            min={1}
                            max={500}
                            defaultValue={item.quantity}
                            className="input w-20 px-2 py-1.5 text-sm"
                          />
                        </div>
                        <button type="submit" className="btn-outline btn-sm">
                          {t("common.save")}
                        </button>
                      </form>

                      <form action={removeCartItemAction} className="ml-auto">
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className="btn-ghost btn-sm text-accent-600 hover:bg-accent-50"
                        >
                          {t("cart.remove")}
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="card h-fit p-5 lg:sticky lg:top-24">
            <h2 className="font-bold">{t("checkout.summary")}</h2>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-700">{t("common.subtotal")}</dt>
                <dd className="font-semibold">{formatMga(cart.subtotalMga)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-700">{t("checkout.deliveryFee")}</dt>
                <dd className="text-ink-500">{t("checkout.calculatedLater")}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-end justify-between border-t border-sand-200 pt-4">
              <span className="font-semibold">{t("common.total")}</span>
              <span className="text-2xl font-black text-brand-700">
                {formatMga(cart.subtotalMga)}
              </span>
            </div>

            <Link href="/commande" className="btn-primary mt-5 w-full py-3">
              {t("cart.checkout")}
            </Link>

            <Link
              href="/produits"
              className="mt-2 block text-center text-sm font-semibold text-brand-700 hover:underline"
            >
              {t("cart.continue")}
            </Link>

            <p className="muted mt-4 text-xs">
              {cart.itemCount} {t("cart.itemCount")}
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
