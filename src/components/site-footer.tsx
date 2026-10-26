import Link from "next/link";

import { translate, type Locale } from "@/lib/i18n";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <footer className="mt-16 border-t border-sand-200 bg-white">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 text-base font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white">
              M
            </span>
            MyPhoto<span className="-ml-1.5 text-brand-600">Mada</span>
          </p>
          <p className="muted mt-3">{t("common.tagline")}</p>
          <p className="muted mt-2 text-xs">{t("footer.madeIn")}</p>
        </div>

        <div>
          <h3 className="text-sm font-bold">{t("nav.products")}</h3>
          <ul className="muted mt-3 space-y-1.5">
            <li>
              <Link href="/produits/tirages" className="hover:text-brand-700">
                {locale === "mg" ? "Sary pirinty" : "Tirages photo"}
              </Link>
            </li>
            <li>
              <Link href="/produits/cadres" className="hover:text-brand-700">
                {locale === "mg" ? "Fefy sy tabilao" : "Cadres & tableaux"}
              </Link>
            </li>
            <li>
              <Link href="/produits/objets" className="hover:text-brand-700">
                {locale === "mg" ? "Zavatra voasoratra anarana" : "Objets personnalisés"}
              </Link>
            </li>
            <li>
              <Link href="/editeur" className="hover:text-brand-700">
                {t("nav.editor")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold">{t("footer.contact")}</h3>
          <ul className="muted mt-3 space-y-1.5">
            <li>Analakely, Antananarivo 101</li>
            <li>contact@myphoto.mg</li>
            <li>+261 34 12 345 67</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold">{t("checkout.payment")}</h3>
          <ul className="muted mt-3 space-y-1.5">
            <li>MVola · Orange Money · Airtel Money</li>
            <li>{t("paymentMethod.CASH_ON_DELIVERY")}</li>
            <li>{t("paymentMethod.BANK_TRANSFER")}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-sand-200 py-4 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} MyPhoto Mada. {t("footer.rights")}
      </div>
    </footer>
  );
}
