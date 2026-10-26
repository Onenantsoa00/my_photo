import type { Metadata } from "next";

import { formatMga } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { prisma } from "@/lib/prisma";
import { updateDeliveryZoneAction } from "@/server/actions/admin";

export const metadata: Metadata = {
  title: "Zones de livraison",
};

export default async function AdminZonesPage() {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const zones = await prisma.deliveryZone.findMany({
    orderBy: [{ city: "asc" }, { feeMga: "asc" }],
  });

  return (
    <div>
      <h1 className="section-title">{t("admin.zones")}</h1>
      <p className="muted mt-2">
        {zones.length} zones · {t("checkout.deliveryFee")} en Ariary
      </p>

      <div className="mt-6 space-y-2">
        {zones.map((zone) => (
          <form
            key={zone.id}
            action={updateDeliveryZoneAction}
            className="card flex flex-wrap items-end gap-3 p-4"
          >
            <input type="hidden" name="zoneId" value={zone.id} />

            <div className="min-w-48 flex-1">
              <p className="text-sm font-semibold">{zone.name}</p>
              <p className="muted text-xs">
                {zone.city} — {zone.region} · {zone.etaDaysMin}–{zone.etaDaysMax}{" "}
                {t("common.days")} · actuellement {formatMga(zone.feeMga)}
              </p>
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
        ))}
      </div>
    </div>
  );
}
