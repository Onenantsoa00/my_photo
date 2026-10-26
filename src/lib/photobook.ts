/**
 * Configuration des photobooks.
 *
 * Un photobook n'est pas un produit à part dans la base : c'est un produit du
 * catalogue (`photobook`) dont les formats sont générés à partir des
 * combinaisons décrites ici — papier × orientation × couverture.
 *
 * Papier proposé : A4, A5, A6 et un carré de 20 cm. Tous tiennent dans la
 * largeur d'une feuille A4 (210 mm), qui est la largeur maximale de la
 * machine.
 *
 * Tarification : 20 pages minimum pour 15 000 Ar, puis 1 000 Ar par page
 * supplémentaire, auquel s'ajoute le supplément de couverture (la couverture
 * solide coûte plus cher que la couverture moyen solide). Le prix est
 * recalculé côté serveur au moment de la commande à partir du nombre de pages
 * réellement enregistré dans la création.
 */

export const PHOTOBOOK_SLUG = "photobook";

/** Format de papier par défaut : A4. */
export const PHOTOBOOK_PAPER: PaperId = "a4";

export const PHOTOBOOK_MIN_PAGES = 20;
export const PHOTOBOOK_MAX_PAGES = 300;
/** Conservé pour les écrans qui parlent du forfait de base. */
export const PHOTOBOOK_PAGES = PHOTOBOOK_MIN_PAGES;

export const PHOTOBOOK_BASE_PRICE_MGA = 15_000;
export const PHOTOBOOK_EXTRA_PAGE_MGA = 1_000;

/** Largeur maximale imprimable : celle d'une feuille A4. */
export const PHOTOBOOK_MAX_WIDTH_MM = 210;

export type PaperId = "a4" | "a5" | "a6" | "carre";
export type OrientationId = "portrait" | "paysage";
export type CoverId = "rigide" | "souple";

export type PaperFormat = {
  id: PaperId;
  /** Côté court en millimètres (orientation portrait). */
  shortMm: number;
  /** Côté long en millimètres. */
  longMm: number;
  /** Nom court, pour les cartes de choix (« A5 », « Carré »…). */
  nameFr: string;
  nameMg: string;
  labelFr: string;
  labelMg: string;
  /** Vrai pour un format sans orientation distincte. */
  isSquare: boolean;
  basePriceMga: number;
};

export const PAPER_FORMATS: PaperFormat[] = [
  {
    id: "a4",
    shortMm: 210,
    longMm: 297,
    nameFr: "A4",
    nameMg: "A4",
    labelFr: "A4 — 21 × 29,7 cm",
    labelMg: "A4 — 21 × 29,7 sm",
    isSquare: false,
    basePriceMga: PHOTOBOOK_BASE_PRICE_MGA,
  },
  {
    id: "a5",
    shortMm: 148,
    longMm: 210,
    nameFr: "A5",
    nameMg: "A5",
    labelFr: "A5 — 14,8 × 21 cm",
    labelMg: "A5 — 14,8 × 21 sm",
    isSquare: false,
    basePriceMga: PHOTOBOOK_BASE_PRICE_MGA,
  },
  {
    id: "a6",
    shortMm: 105,
    longMm: 148,
    nameFr: "A6",
    nameMg: "A6",
    labelFr: "A6 — 10,5 × 14,8 cm",
    labelMg: "A6 — 10,5 × 14,8 sm",
    isSquare: false,
    basePriceMga: PHOTOBOOK_BASE_PRICE_MGA,
  },
  {
    id: "carre",
    shortMm: 200,
    longMm: 200,
    nameFr: "Carré",
    nameMg: "Kare",
    labelFr: "Carré — 20 × 20 cm",
    labelMg: "Kare — 20 × 20 sm",
    isSquare: true,
    basePriceMga: PHOTOBOOK_BASE_PRICE_MGA,
  },
];

export type Orientation = {
  id: OrientationId;
  labelFr: string;
  labelMg: string;
  /** Vrai si la page est plus haute que large. */
  isPortrait: boolean;
};

export const ORIENTATIONS: Orientation[] = [
  {
    id: "portrait",
    labelFr: "Portrait (vertical)",
    labelMg: "Mitsangana",
    isPortrait: true,
  },
  {
    id: "paysage",
    labelFr: "Paysage (horizontal)",
    labelMg: "Mandry",
    isPortrait: false,
  },
];

export type Cover = {
  id: CoverId;
  labelFr: string;
  labelMg: string;
  descriptionFr: string;
  descriptionMg: string;
  /** Supplément appliqué au prix : la couverture solide est la plus chère. */
  extraPriceMga: number;
};

export const COVERS: Cover[] = [
  {
    id: "rigide",
    labelFr: "Couverture solide",
    labelMg: "Fonony mafy",
    descriptionFr:
      "Cartonnée rigide, imprimée sur le plat, dos cousu. La plus durable.",
    descriptionMg:
      "Baoritra mafy, pirinty amin'ny fonony, voaisy fanjaitra. Maharitra indrindra.",
    extraPriceMga: 5_000,
  },
  {
    id: "souple",
    labelFr: "Couverture moyen solide",
    labelMg: "Fonony semi-rigide",
    descriptionFr:
      "Semi-rigide brillante, plus légère et moins chère, adaptée aux albums souvenirs.",
    descriptionMg:
      "Semi-rigide mazava, maivana sy mora vidy, mety amin'ny rakitsary fahatsiarovana.",
    extraPriceMga: 0,
  },
];

export type PhotobookSelection = {
  paper: PaperId;
  orientation: OrientationId;
  cover: CoverId;
};

export type PhotobookPrice = {
  pageCount: number;
  includedPages: number;
  extraPages: number;
  baseMga: number;
  extraMga: number;
  /** Supplément de couverture (couverture solide). */
  coverExtraMga: number;
  totalMga: number;
};

export function findPaper(paper: PaperId): PaperFormat {
  const found = PAPER_FORMATS.find((format) => format.id === paper);
  if (!found) throw new Error(`Format papier inconnu : ${paper}`);
  return found;
}

export function findOrientation(orientation: OrientationId): Orientation {
  const found = ORIENTATIONS.find((item) => item.id === orientation);
  if (!found) throw new Error(`Orientation inconnue : ${orientation}`);
  return found;
}

export function findCover(cover: CoverId): Cover {
  const found = COVERS.find((item) => item.id === cover);
  if (!found) throw new Error(`Couverture inconnue : ${cover}`);
  return found;
}

/** Un format carré n'a qu'une seule orientation. */
export function orientationsForPaper(paper: PaperId): Orientation[] {
  if (findPaper(paper).isSquare) {
    return ORIENTATIONS.filter((item) => item.id === "portrait");
  }
  return ORIENTATIONS;
}

/** Supplément de couverture d'une sélection. */
export function coverExtraMga(selection: Pick<PhotobookSelection, "cover">): number {
  return findCover(selection.cover).extraPriceMga;
}

/**
 * Supplément de couverture porté par un format du catalogue.
 *
 * La référence d'un format encode la couverture (`photobook-a4-portrait-rigide`)
 * : le serveur en déduit le supplément sans stocker de colonne supplémentaire.
 * Un format non photobook n'encode rien et ne paie aucun supplément.
 */
export function coverExtraFromSku(sku: string | null | undefined): number {
  if (!sku) return 0;
  const cover = sku.split("-").pop() as CoverId | undefined;
  if (cover !== "rigide" && cover !== "souple") return 0;
  return findCover(cover).extraPriceMga;
}

/** Ramène un nombre de pages dans les bornes vendables. */
export function normalizePageCount(value: number): number {
  const integer = Math.trunc(Number(value) || PHOTOBOOK_MIN_PAGES);
  return Math.min(PHOTOBOOK_MAX_PAGES, Math.max(PHOTOBOOK_MIN_PAGES, integer));
}

/** 20 pages = 15 000 Ar, puis 1 000 Ar par page supplémentaire. */
export function photobookPriceMga(pageCount: number, coverExtraMga = 0): number {
  return photobookPriceBreakdown(pageCount, coverExtraMga).totalMga;
}

export function photobookPriceBreakdown(
  pageCount: number,
  coverExtraMga = 0,
): PhotobookPrice {
  const pages = normalizePageCount(pageCount);
  const extraPages = Math.max(0, pages - PHOTOBOOK_MIN_PAGES);
  const cover = Math.max(0, Math.round(coverExtraMga || 0));
  const extraMga = extraPages * PHOTOBOOK_EXTRA_PAGE_MGA;

  return {
    pageCount: pages,
    includedPages: PHOTOBOOK_MIN_PAGES,
    extraPages,
    baseMga: PHOTOBOOK_BASE_PRICE_MGA,
    extraMga,
    coverExtraMga: cover,
    totalMga: PHOTOBOOK_BASE_PRICE_MGA + extraMga + cover,
  };
}

/** Dimensions en millimètres d'une combinaison papier × orientation. */
export function selectionSize(selection: PhotobookSelection): {
  widthMm: number;
  heightMm: number;
} {
  const paper = findPaper(selection.paper);
  const portrait = findOrientation(selection.orientation).isPortrait;

  return {
    widthMm: portrait ? paper.shortMm : paper.longMm,
    heightMm: portrait ? paper.longMm : paper.shortMm,
  };
}

export function selectionPriceMga(
  selection: PhotobookSelection,
  pageCount = PHOTOBOOK_MIN_PAGES,
): number {
  return photobookPriceMga(pageCount, coverExtraMga(selection));
}

/**
 * Référence du format correspondant à une combinaison.
 *
 * Elle est calculée, jamais saisie : le seed et l'assistant produisent donc
 * forcément la même valeur pour la même combinaison.
 */
export function photobookSku(selection: PhotobookSelection): string {
  return `${PHOTOBOOK_SLUG}-${selection.paper}-${selection.orientation}-${selection.cover}`;
}

export function photobookLabel(
  selection: PhotobookSelection,
  locale: "fr" | "mg",
  pageCount = PHOTOBOOK_MIN_PAGES,
): string {
  const paper = findPaper(selection.paper);
  const orientation = findOrientation(selection.orientation);
  const cover = findCover(selection.cover);
  const { widthMm, heightMm } = selectionSize(selection);
  const pages = normalizePageCount(pageCount);

  const size = `${widthMm / 10} × ${heightMm / 10} cm`;
  const orientationPart = paper.isSquare ? null : (locale === "mg" ? orientation.labelMg : orientation.labelFr);
  const parts = [
    locale === "mg" ? paper.nameMg : paper.nameFr,
    ...(orientationPart ? [orientationPart] : []),
    locale === "mg" ? cover.labelMg : cover.labelFr,
  ];

  const pagesLabel =
    locale === "mg"
      ? `${pages} pejy (farafahakeliny ${PHOTOBOOK_MIN_PAGES})`
      : `${pages} pages (minimum ${PHOTOBOOK_MIN_PAGES})`;

  return `${parts.join(" · ")} — ${size}, ${pagesLabel}`;
}

export type PhotobookVariantSeed = {
  sku: string;
  label: string;
  widthMm: number;
  heightMm: number;
  priceMga: number;
  isDefault: boolean;
  sortOrder: number;
};

/**
 * Toutes les combinaisons vendables, dans un ordre stable.
 *
 * Un format carré n'a qu'une orientation : 3 papiers × 2 orientations ×
 * 2 couvertures + 1 carré × 2 couvertures = 14 formats.
 */
export function photobookVariantSeeds(): PhotobookVariantSeed[] {
  const seeds: PhotobookVariantSeed[] = [];

  PAPER_FORMATS.forEach((paper, paperIndex) => {
    orientationsForPaper(paper.id).forEach((orientation, orientationIndex) => {
      COVERS.forEach((cover, coverIndex) => {
        const selection: PhotobookSelection = {
          paper: paper.id,
          orientation: orientation.id,
          cover: cover.id,
        };
        const { widthMm, heightMm } = selectionSize(selection);

        seeds.push({
          sku: photobookSku(selection),
          label: photobookLabel(selection, "fr"),
          widthMm,
          heightMm,
          priceMga: paper.basePriceMga + cover.extraPriceMga,
          // Le format le plus courant du marché local : A4 portrait, solide.
          isDefault:
            paper.id === "a4" &&
            orientation.id === "portrait" &&
            cover.id === "rigide",
          sortOrder:
            paperIndex * ORIENTATIONS.length * COVERS.length +
            orientationIndex * COVERS.length +
            coverIndex,
        });
      });
    });
  });

  return seeds;
}

/** Vrai si l'identifiant reçu du formulaire correspond à une combinaison valide. */
export function isPhotobookSelection(value: {
  paper?: unknown;
  orientation?: unknown;
  cover?: unknown;
}): value is PhotobookSelection {
  return (
    PAPER_FORMATS.some((format) => format.id === value.paper) &&
    ORIENTATIONS.some((item) => item.id === value.orientation) &&
    COVERS.some((item) => item.id === value.cover)
  );
}
