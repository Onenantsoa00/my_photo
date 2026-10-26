import type { Locale } from "@/lib/i18n";

/** Engagements de production affichés sur les fiches produit. */
export function productionNotices(locale: Locale): string[] {
  if (locale === "mg") {
    return [
      "Pirinty 300 dpi amin'ny taratasy sary matihanina",
      "Voatapaka marina araka ny habe nofidina",
      "Vita any Antananarivo ato an-toerana",
      "Alefa manerana an'i Madagasikara",
    ];
  }

  return [
    "Impression 300 dpi sur papier photo professionnel",
    "Découpe précise au format choisi",
    "Fabrication locale à Antananarivo",
    "Livraison partout à Madagascar",
  ];
}
