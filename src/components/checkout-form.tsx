"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/locale-provider";
import { formatMga } from "@/lib/format";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL_KEY,
  paymentMethodIcon,
  requiresTransactionReference,
  type PaymentMethodValue,
} from "@/lib/payment";
import { createOrderAction, type CheckoutState } from "@/server/actions/orders";

export type CheckoutZone = {
  id: string;
  name: string;
  region: string;
  city: string;
  feeMga: number;
};

export type CheckoutFormProps = {
  zones: CheckoutZone[];
  subtotalMga: number;
  itemCount: number;
  paymentTargets: Record<PaymentMethodValue, string | null>;
  defaults: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  };
};

const INITIAL: CheckoutState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button type="submit" disabled={pending} className="btn-primary w-full py-3 text-base">
      {pending ? t("common.loading") : label}
    </button>
  );
}

function FieldError({ code }: { code?: string }) {
  const t = useT();

  if (!code) return null;

  return (
    <p className="mt-1 text-xs font-semibold text-accent-600">
      {code === "required" ? t("common.requiredField") : t("common.invalidValue")}
    </p>
  );
}

export function CheckoutForm({
  zones,
  subtotalMga,
  itemCount,
  paymentTargets,
  defaults,
}: CheckoutFormProps) {
  const t = useT();
  const [state, formAction] = useActionState(createOrderAction, INITIAL);

  const [deliveryMode, setDeliveryMode] = useState<"PICKUP" | "HOME_DELIVERY">(
    "HOME_DELIVERY",
  );
  const [zoneId, setZoneId] = useState<string>(zones[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>(
    "CASH_ON_DELIVERY",
  );

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === zoneId) ?? null,
    [zones, zoneId],
  );

  const deliveryFee = deliveryMode === "HOME_DELIVERY" ? (selectedZone?.feeMga ?? 0) : 0;
  const total = subtotalMga + deliveryFee;
  const needsReference = requiresTransactionReference(paymentMethod);
  const merchantTarget = paymentTargets[paymentMethod];

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        {/* ------------------------------------------------------- Coordonnées */}
        <section className="card p-5">
          <h2 className="font-bold">{t("checkout.contact")}</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="customerName">
                {t("checkout.fullName")}
              </label>
              <input
                id="customerName"
                name="customerName"
                className="input"
                required
                defaultValue={defaults.customerName}
              />
              <FieldError code={state.fieldErrors?.customerName} />
            </div>

            <div>
              <label className="label" htmlFor="customerEmail">
                {t("checkout.email")}
              </label>
              <input
                id="customerEmail"
                name="customerEmail"
                type="email"
                className="input"
                required
                defaultValue={defaults.customerEmail}
              />
              <FieldError code={state.fieldErrors?.customerEmail} />
            </div>

            <div>
              <label className="label" htmlFor="customerPhone">
                {t("checkout.phone")}
              </label>
              <input
                id="customerPhone"
                name="customerPhone"
                className="input"
                required
                placeholder="+261 34 12 345 67"
                defaultValue={defaults.customerPhone}
              />
              <FieldError code={state.fieldErrors?.customerPhone} />
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- Livraison */}
        <section className="card p-5">
          <h2 className="font-bold">{t("checkout.delivery")}</h2>

          <div className="mt-4 space-y-2">
            {(
              [
                { value: "HOME_DELIVERY" as const, label: t("checkout.homeDelivery") },
                { value: "PICKUP" as const, label: t("checkout.pickup") },
              ]
            ).map((option) => (
              <label
                key={option.value}
                className={
                  deliveryMode === option.value
                    ? "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-brand-600 bg-brand-50 px-4 py-3"
                    : "flex cursor-pointer items-center gap-3 rounded-xl border border-sand-300 px-4 py-3 hover:border-brand-300"
                }
              >
                <input
                  type="radio"
                  name="deliveryMode"
                  value={option.value}
                  checked={deliveryMode === option.value}
                  onChange={() => setDeliveryMode(option.value)}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="text-sm font-semibold">{option.label}</span>
              </label>
            ))}
          </div>

          {deliveryMode === "HOME_DELIVERY" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="deliveryZoneId">
                  {t("checkout.zone")}
                </label>
                <select
                  id="deliveryZoneId"
                  name="deliveryZoneId"
                  className="input"
                  value={zoneId}
                  onChange={(event) => setZoneId(event.target.value)}
                >
                  <option value="">{t("checkout.chooseZone")}</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} — {formatMga(zone.feeMga)}
                    </option>
                  ))}
                </select>
                <FieldError code={state.fieldErrors?.deliveryZoneId} />
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor="addressLine">
                  {t("checkout.address")}
                </label>
                <textarea
                  id="addressLine"
                  name="addressLine"
                  className="input min-h-20"
                  placeholder={t("checkout.addressHint")}
                />
                <FieldError code={state.fieldErrors?.addressLine} />
              </div>
            </div>
          ) : (
            <>
              <input type="hidden" name="city" value="Antananarivo" />
              <input type="hidden" name="region" value="Analamanga" />
              <p className="muted mt-3 text-sm">{t("checkout.pickupFree")}</p>
            </>
          )}
        </section>

        {/* ---------------------------------------------------------- Paiement */}
        <section className="card p-5">
          <h2 className="font-bold">{t("checkout.payment")}</h2>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {PAYMENT_METHODS.map((method) => (
              <label
                key={method}
                className={
                  paymentMethod === method
                    ? "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-brand-600 bg-brand-50 px-3 py-2.5"
                    : "flex cursor-pointer items-center gap-3 rounded-xl border border-sand-300 px-3 py-2.5 hover:border-brand-300"
                }
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={() => setPaymentMethod(method)}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="text-sm font-semibold">
                  {paymentMethodIcon(method)} {t(PAYMENT_METHOD_LABEL_KEY[method])}
                </span>
              </label>
            ))}
          </div>

          {paymentMethod === "CASH_ON_DELIVERY" ? (
            <p className="muted mt-3 text-sm">{t("checkout.codHint")}</p>
          ) : (
            <div className="mt-4 rounded-xl bg-sand-100 p-4">
              <p className="text-sm text-ink-700">{t("checkout.mobileMoneyHint")}</p>

              {merchantTarget ? (
                <p className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="muted text-xs uppercase tracking-wide">
                    {t("checkout.merchantNumber")}
                  </span>
                  <strong className="rounded-lg bg-white px-3 py-1 font-mono text-sm ring-1 ring-sand-300">
                    {merchantTarget}
                  </strong>
                  <span className="text-xs text-ink-500">
                    · {t("order.sentAmount")} {formatMga(total)}
                  </span>
                </p>
              ) : null}

              {needsReference ? (
                <div className="mt-4">
                  <label className="label" htmlFor="paymentReference">
                    {t("checkout.transactionRef")}
                  </label>
                  <input
                    id="paymentReference"
                    name="paymentReference"
                    className="input"
                    placeholder={t("checkout.transactionRefHint")}
                  />
                  <FieldError code={state.fieldErrors?.paymentReference} />
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* --------------------------------------------------------------- Note */}
        <section className="card p-5">
          <label className="label" htmlFor="customerNote">
            {t("checkout.note")} ({t("common.optional")})
          </label>
          <textarea id="customerNote" name="customerNote" className="input min-h-20" />
        </section>
      </div>

      {/* ------------------------------------------------------------- Résumé */}
      <aside className="card h-fit p-5 lg:sticky lg:top-24">
        <h2 className="font-bold">{t("checkout.summary")}</h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-700">
              {t("common.subtotal")} ({itemCount})
            </dt>
            <dd className="font-semibold">{formatMga(subtotalMga)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-700">{t("checkout.deliveryFee")}</dt>
            <dd className="font-semibold">
              {deliveryMode === "PICKUP" ? t("checkout.pickupFree") : formatMga(deliveryFee)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex items-end justify-between border-t border-sand-200 pt-4">
          <span className="font-semibold">{t("order.total")}</span>
          <span className="text-2xl font-black text-brand-700">{formatMga(total)}</span>
        </div>

        <div className="mt-5">
          <SubmitButton label={t("checkout.placeOrder")} />
        </div>

        {state.errorKey ? (
          <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-700">
            {t(state.errorKey)}
          </p>
        ) : null}
      </aside>
    </form>
  );
}
