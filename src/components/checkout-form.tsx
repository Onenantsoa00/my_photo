"use client";

import { Check, Copy, ShieldCheck } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/locale-provider";
import { formatMga } from "@/lib/format";
import {
  PAYMENT_ACCOUNTS,
  PAYMENT_ACCOUNT_NAME,
  PAYMENT_METHODS,
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
  /** Nom du projet, utilisé comme motif du transfert Mobile Money. */
  paymentMotif: string;
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
  paymentMotif,
  paymentTargets,
  defaults,
}: CheckoutFormProps) {
  const t = useT();
  const [state, formAction] = useActionState(createOrderAction, INITIAL);
  const [copied, setCopied] = useState(false);

  const [deliveryMode, setDeliveryMode] = useState<"PICKUP" | "HOME_DELIVERY">(
    "HOME_DELIVERY",
  );
  const [zoneId, setZoneId] = useState<string>(zones[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>(
    PAYMENT_METHODS[0],
  );

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === zoneId) ?? null,
    [zones, zoneId],
  );

  const deliveryFee = deliveryMode === "HOME_DELIVERY" ? (selectedZone?.feeMga ?? 0) : 0;
  const total = subtotalMga + deliveryFee;
  const merchantTarget = paymentTargets[paymentMethod];
  const account = PAYMENT_ACCOUNTS[paymentMethod as keyof typeof PAYMENT_ACCOUNTS];

  const copyNumber = async () => {
    if (!merchantTarget) return;
    try {
      await navigator.clipboard.writeText(merchantTarget);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">{t("checkout.payment")}</h2>
            <span className="badge-brand inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Mobile Money
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {PAYMENT_METHODS.map((method) => {
              const methodAccount = PAYMENT_ACCOUNTS[method];
              const active = paymentMethod === method;

              return (
                <label
                  key={method}
                  className={
                    active
                      ? "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-brand-600 bg-brand-50 px-3 py-2.5 dark:bg-brand-900/30"
                      : "flex cursor-pointer items-center gap-3 rounded-xl border border-sand-300 bg-card px-3 py-2.5 hover:border-brand-300"
                  }
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={active}
                    onChange={() => setPaymentMethod(method)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[11px] font-black ${
                      method === "MVOLA"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
                        : "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
                    }`}
                  >
                    {method === "MVOLA" ? "MV" : "OM"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{methodAccount.labelFr}</span>
                    <span className="block font-mono text-[11px] text-ink-500">
                      {methodAccount.number}
                    </span>
                  </span>
                  {active ? <Check className="h-4 w-4 shrink-0 text-brand-600" /> : null}
                </label>
              );
            })}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-sand-50 dark:border-brand-800 dark:from-brand-900/40 dark:to-sand-100">
            <div className="flex flex-wrap items-center gap-3 border-b border-brand-200/70 p-4 dark:border-brand-800">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-700 dark:text-brand-200">
                  {t("checkout.merchantNumber")} · {account.labelFr}
                </p>
                <p className="mt-1 font-mono text-xl font-black tracking-wide text-ink-900">
                  {merchantTarget ?? "—"}
                </p>
                <p className="text-xs text-ink-500">{PAYMENT_ACCOUNT_NAME}</p>
              </div>
              <button type="button" onClick={copyNumber} className="btn-outline btn-sm">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t("common.copied") : t("common.copy")}
              </button>
            </div>

            <dl className="grid gap-3 p-4 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-500">
                  {t("checkout.paymentMotif")}
                </dt>
                <dd className="mt-0.5 font-semibold text-ink-900">{paymentMotif}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-ink-500">
                  {t("order.sentAmount")}
                </dt>
                <dd className="mt-0.5 text-base font-black text-brand-700 dark:text-brand-300">
                  {formatMga(total)}
                </dd>
              </div>
            </dl>
          </div>

          <ol className="mt-4 space-y-2 text-xs text-ink-700">
            {[
              t("checkout.step1"),
              t("checkout.step2"),
              t("checkout.step3"),
              t("checkout.step4"),
            ].map((step, index) => (
              <li key={step} className="flex items-start gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4">
            <label className="label" htmlFor="paymentReference">
              {t("checkout.transactionRef")}
            </label>
            <input
              id="paymentReference"
              name="paymentReference"
              className="input"
              required
              placeholder={t("checkout.transactionRefHint")}
            />
            <FieldError code={state.fieldErrors?.paymentReference} />
          </div>
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
