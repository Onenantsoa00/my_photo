"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { formatMga } from "@/lib/format";
import { useT } from "@/components/locale-provider";
import { addToCartAction, type CartActionResult } from "@/server/actions/cart";

type Variant = {
  id: string;
  label: string;
  priceMga: number;
  widthMm: number | null;
  heightMm: number | null;
  isDefault: boolean;
};

const INITIAL: CartActionResult = { ok: false };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="btn-primary flex-1 py-3 text-base">
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ProductPurchasePanel({
  productId,
  productSlug,
  variants,
  leadTimeDays,
}: {
  productId: string;
  productSlug: string;
  variants: Variant[];
  leadTimeDays: number;
}) {
  const t = useT();
  const [state, formAction] = useActionState(addToCartAction, INITIAL);

  const [variantId, setVariantId] = useState(
    () => (variants.find((variant) => variant.isDefault) ?? variants[0])?.id ?? "",
  );
  const [quantity, setQuantity] = useState(1);

  const selected = variants.find((variant) => variant.id === variantId) ?? variants[0];

  if (!selected) {
    return <p className="muted">{t("products.empty")}</p>;
  }

  const editorHref = `/editeur?product=${encodeURIComponent(productSlug)}&variant=${encodeURIComponent(selected.id)}`;

  return (
    <div className="space-y-5">
      <div>
        <span className="label">{t("product.chooseFormat")}</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {variants.map((variant) => {
            const active = variant.id === variantId;
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => setVariantId(variant.id)}
                aria-pressed={active}
                className={
                  active
                    ? "flex items-center justify-between rounded-xl border-2 border-brand-600 bg-brand-50 px-3 py-2.5 text-left"
                    : "flex items-center justify-between rounded-xl border border-sand-300 bg-white px-3 py-2.5 text-left hover:border-brand-300"
                }
              >
                <span className="text-sm font-semibold">{variant.label}</span>
                <span className="text-sm font-bold text-brand-700">
                  {formatMga(variant.priceMga)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="w-28">
          <label className="label" htmlFor="purchase-quantity">
            {t("product.chooseQuantity")}
          </label>
          <input
            id="purchase-quantity"
            className="input"
            type="number"
            min={1}
            max={500}
            value={quantity}
            onChange={(event) =>
              setQuantity(Math.max(1, Math.min(500, Number(event.target.value) || 1)))
            }
          />
        </div>

        <div className="flex-1 rounded-xl bg-sand-100 px-4 py-2.5">
          <span className="muted block text-xs">{t("common.total")}</span>
          <span className="text-xl font-bold text-brand-700">
            {formatMga(selected.priceMga * quantity)}
          </span>
        </div>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="variantId" value={selected.id} />
        <input type="hidden" name="quantity" value={quantity} />
        <input type="hidden" name="designId" value="none" />

        <div className="flex flex-wrap gap-3">
          <SubmitButton label={t("product.addToCart")} pendingLabel={t("common.loading")} />
          <Link
            href={editorHref}
            className="btn-outline flex-1 py-3 text-base"
          >
            🎨 {t("product.designNow")}
          </Link>
        </div>

        {state.ok ? (
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">
            ✓ {t("product.added")} —{" "}
            <Link href="/panier" className="underline">
              {t("cart.title")}
            </Link>
          </p>
        ) : null}
      </form>

      <p className="muted">
        {t("product.leadTime")} {leadTimeDays} {leadTimeDays > 1 ? t("common.days") : t("common.day")}
      </p>
    </div>
  );
}
