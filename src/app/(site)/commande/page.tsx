import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/checkout-form";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { PAYMENT_METHODS, paymentTargetFor, type PaymentMethodValue } from "@/lib/payment";
import { getSessionUser } from "@/server/auth";
import { getCartDetail } from "@/server/cart";
import { listDeliveryZones } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Finaliser ma commande",
};

export default async function CheckoutPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const cart = await getCartDetail();

  if (cart.items.length === 0) {
    redirect("/panier");
  }

  const [zones, user] = await Promise.all([listDeliveryZones(), getSessionUser()]);

  // Les numéros marchand vivent côté serveur : on les transmet explicitement
  // au formulaire, ils ne sont jamais exposés par une variable NEXT_PUBLIC_.
  const paymentTargets = PAYMENT_METHODS.reduce(
    (accumulator, method) => {
      accumulator[method] = paymentTargetFor(method);
      return accumulator;
    },
    {} as Record<PaymentMethodValue, string | null>,
  );

  return (
    <div className="container-page py-10">
      <h1 className="section-title">{t("checkout.title")}</h1>
      <p className="muted mt-2">{t("checkout.summary")}</p>

      <div className="mt-6">
        <CheckoutForm
          paymentMotif={
            cart.items
              .map((item) => item.designTitle)
              .filter((title): title is string => Boolean(title))
              .join(", ")
              .slice(0, 160) || "Photobook MyPhoto Mada"
          }
          zones={zones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            region: zone.region,
            city: zone.city,
            feeMga: zone.feeMga,
          }))}
          subtotalMga={cart.subtotalMga}
          itemCount={cart.itemCount}
          paymentTargets={paymentTargets}
          defaults={{
            customerName: user?.name ?? "",
            customerEmail: user?.email ?? "",
            customerPhone: user?.phone ?? "",
          }}
        />
      </div>
    </div>
  );
}
