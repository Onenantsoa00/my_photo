import type { Metadata } from "next";

import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatMga } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { prisma } from "@/lib/prisma";
import {
  createDeliveryZoneAction,
  deleteDeliveryZoneAction,
  updateDeliveryZoneAction,
} from "@/server/actions/admin";

export const metadata: Metadata = {
  title: "Zones de livraison",
};

export default async function AdminZonesPage() {
  const locale = await getLocale();
  const t = (
    key: Parameters<typeof translate>[1],
    replacements?: Record<string, string | number>,
  ) => translate(locale, key, replacements);

  const zones = await prisma.deliveryZone.findMany({
    orderBy: [{ city: "asc" }, { feeMga: "asc" }],
  });

  return (
    <div>
      <h1 className="section-title">{t("admin.zones")}</h1>
      <p className="muted mt-2">
        {zones.length} zones · {t("checkout.deliveryFee")} en Ariary
      </p>

      {/* ------------------------------------------------------ Création */}
      <section className="card mt-6 p-5">
        <h2 className="font-bold">{t("admin.addZone")}</h2>

        <form
          action={createDeliveryZoneAction}
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div>
            <label className="label text-[11px]" htmlFor="zone-name">
              {t("admin.zoneName")}
            </label>
            <input id="zone-name" name="name" required className="input" />
          </div>

          <div>
            <label className="label text-[11px]" htmlFor="zone-city">
              {t("checkout.city")}
            </label>
            <input id="zone-city" name="city" required className="input" />
          </div>

          <div>
            <label className="label text-[11px]" htmlFor="zone-region">
              {t("checkout.region")}
            </label>
            <input id="zone-region" name="region" className="input" />
          </div>

          <div>
            <label className="label text-[11px]" htmlFor="zone-fee">
              {t("checkout.deliveryFee")}
            </label>
            <input
              id="zone-fee"
              name="feeMga"
              type="number"
              min={0}
              step={500}
              required
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-[11px]" htmlFor="zone-eta-min">
                Min ({t("common.days")})
              </label>
              <input
                id="zone-eta-min"
                name="etaDaysMin"
                type="number"
                min={0}
                max={30}
                defaultValue={1}
                className="input"
              />
            </div>
            <div>
              <label className="label text-[11px]" htmlFor="zone-eta-max">
                Max ({t("common.days")})
              </label>
              <input
                id="zone-eta-max"
                name="etaDaysMax"
                type="number"
                min={0}
                max={60}
                defaultValue={3}
                className="input"
              />
            </div>
          </div>

          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                className="h-4 w-4 accent-brand-600"
              />
              {t("admin.productActive")}
            </label>

            <button type="submit" className="btn-primary btn-sm ml-auto">
              {t("common.save")}
            </button>
          </div>
        </form>
      </section>

      {/* -------------------------------------------------------- Liste */}
      <div className="mt-6 space-y-2">
        {zones.map((zone) => (
          <div key={zone.id} className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 pb-2">
              <p className="text-sm font-bold">
                {zone.name}
                {!zone.isActive ? (
                  <span className="badge-neutral ml-2">{t("admin.productInactive")}</span>
                ) : null}
              </p>

              <form action={deleteDeliveryZoneAction}>
                <input type="hidden" name="zoneId" value={zone.id} />
                <ConfirmSubmit
                  message={t("admin.deleteConfirm", { name: zone.name })}
                  className="text-[11px] font-semibold text-accent-600 hover:underline"
                >
                  {t("admin.deleteZone")}
                </ConfirmSubmit>
              </form>
            </div>

            <form
              action={updateDeliveryZoneAction}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="zoneId" value={zone.id} />

              <div className="min-w-48 flex-1">
                <label className="label text-[11px]" htmlFor={`name-${zone.id}`}>
                  {t("admin.zoneName")}
                </label>
                <input
                  id={`name-${zone.id}`}
                  name="name"
                  defaultValue={zone.name}
                  className="input px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="label text-[11px]" htmlFor={`city-${zone.id}`}>
                  {t("checkout.city")}
                </label>
                <input
                  id={`city-${zone.id}`}
                  name="city"
                  defaultValue={zone.city}
                  className="input w-36 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="label text-[11px]" htmlFor={`region-${zone.id}`}>
                  {t("checkout.region")}
                </label>
                <input
                  id={`region-${zone.id}`}
                  name="region"
                  defaultValue={zone.region}
                  className="input w-36 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="label text-[11px]" htmlFor={`fee-${zone.id}`}>
                  {t("checkout.deliveryFee")}
                </label>
                <input
                  id={`fee-${zone.id}`}
                  name="feeMga"
                  type="number"
                  min={0}
                  step={500}
                  defaultValue={zone.feeMga}
                  className="input w-28 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="label text-[11px]" htmlFor={`etaMin-${zone.id}`}>
                  Min ({t("common.days")})
                </label>
                <input
                  id={`etaMin-${zone.id}`}
                  name="etaDaysMin"
                  type="number"
                  min={0}
                  max={30}
                  defaultValue={zone.etaDaysMin}
                  className="input w-20 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="label text-[11px]" htmlFor={`etaMax-${zone.id}`}>
                  Max ({t("common.days")})
                </label>
                <input
                  id={`etaMax-${zone.id}`}
                  name="etaDaysMax"
                  type="number"
                  min={0}
                  max={60}
                  defaultValue={zone.etaDaysMax}
                  className="input w-20 px-2 py-1.5 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 pb-2 text-xs">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={zone.isActive}
                  className="h-4 w-4 accent-brand-600"
                />
                {t("admin.productActive")}
              </label>

              <button type="submit" className="btn-primary btn-sm">
                {t("common.save")}
              </button>
            </form>

            <div className="mt-3 border-t border-sand-200 pt-3">
              <p className="muted text-xs">
                {zone.city} — {zone.region} · {zone.etaDaysMin}–{zone.etaDaysMax}{" "}
                {t("common.days")} · actuellement {formatMga(zone.feeMga)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
