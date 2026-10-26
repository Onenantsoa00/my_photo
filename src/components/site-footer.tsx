import Link from "next/link";

import { PAYMENT_ACCOUNTS, PAYMENT_ACCOUNT_NAME } from "@/lib/payment";
import { translate, type Locale } from "@/lib/i18n";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <footer className="mt-20 border-t border-sand-200 bg-card">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 text-base font-extrabold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 text-sm font-black text-white">
              M
            </span>
            MyPhoto<span className="-ml-1.5 text-brand-600">Mada</span>
          </p>
          <p className="muted mt-3 leading-relaxed">{t("common.tagline")}</p>
          <p className="muted mt-2 text-xs">{t("footer.madeIn")}</p>
        </div>

        <div>
          <h3 className="text-sm font-bold">{t("nav.photobooks")}</h3>
          <ul className="muted mt-3 space-y-1.5">
            <li>
              <Link href="/produits/photobook" className="hover:text-brand-700">
                Photobooks
              </Link>
            </li>
            <li>
              <Link href="/creer" className="hover:text-brand-700">
                {t("nav.editor")}
              </Link>
            </li>
            <li>
              <Link href="/compte" className="hover:text-brand-700">
                {t("account.drafts")}
              </Link>
            </li>
            <li>
              <Link href="/panier" className="hover:text-brand-700">
                {t("nav.cart")}
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
          <ul className="muted mt-3 space-y-2">
            <li>
              <span className="block text-xs font-semibold text-ink-700">MVola</span>
              <span className="font-mono text-xs">{PAYMENT_ACCOUNTS.MVOLA.number}</span>
            </li>
            <li>
              <span className="block text-xs font-semibold text-ink-700">Orange Money</span>
              <span className="font-mono text-xs">{PAYMENT_ACCOUNTS.ORANGE_MONEY.number}</span>
            </li>
            <li className="text-[11px] leading-relaxed">{PAYMENT_ACCOUNT_NAME}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-sand-200 py-4 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} MyPhoto Mada. {t("footer.rights")}
      </div>
    </footer>
  );
}
