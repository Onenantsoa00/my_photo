/**
 * Configuration des photobooks.
 *
 * Un photobook n'est pas un produit à part dans la base : c'est un produit du
 * catalogue (`photobook`) dont les formats sont générés à partir des
 * combinaisons décrites ici — papier × orientation × couverture.
 *
 * Conséquence : le tunnel existant (panier, commande, back-office, calcul des
 * 300 dpi depuis `widthMm`/`heightMm`) fonctionne sans modification, parce
 * qu'un photobook « A4 paysage couverture rigide » n'est qu'un format de plus.
 *
 * Le seed (`prisma/seed.ts`) et l'assistant `/creer` partagent ce fichier : la
 * référence de format (SKU) est donc calculée de la même façon des deux côtés.
 */

export const PHOTOBOOK_SLUG = "photobook";
export const PHOTOBOOK_PAGES = 20;

export type PaperId = "a5" | "a4" | "a3" | "carre20" | "carre30";
export type OrientationId = "portrait" | "paysage";
export type CoverId = "rigide" | "souple";

export type PaperFormat = {
  id: PaperId;
  /** Côté court en millimètres (orientation portrait). */
  shortMm: number;
  /** Côté long en millimètres. */
  longMm: number;
  labelFr: string;
  labelMg: string;
  basePriceMga: number;
};

export const PAPER_FORMATS: PaperFormat[] = [
  {
    id: "a5",
    shortMm: 148,
    longMm: 210,
    labelFr: "A5 — 14,8 × 21 cm",
    labelMg: "A5 — 14,8 × 21 sm",
    basePriceMga: 75_000,
  },
  {
    id: "a4",
    shortMm: 210,
    longMm: 297,
    labelFr: "A4 — 21 × 29,7 cm",
    labelMg: "A4 — 21 × 29,7 sm",
    basePriceMga: 110_000,
  },
  {
    id: "a3",
    shortMm: 297,
    longMm: 420,
    labelFr: "A3 — 29,7 × 42 cm",
    labelMg: "A3 — 29,7 × 42 sm",
    basePriceMga: 175_000,
  },
  {
    id: "carre20",
    shortMm: 200,
    longMm: 200,
    labelFr: "Carré — 20 × 20 cm",
    labelMg: "Efajoro — 20 × 20 sm",
    basePriceMga: 100_000,
  },
  {
    id: "carre30",
    shortMm: 300,
    longMm: 300,
    labelFr: "Carré — 30 × 30 cm",
    labelMg: "Efajoro — 30 × 30 sm",
    basePriceMga: 190_000,
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
  /** Supplément appliqué au prix du format papier. */
  extraPriceMga: number;
};

export const COVERS: Cover[] = [
  {
    id: "rigide",
    labelFr: "Couverture solide",
    labelMg: "Fonony mafy",
    descriptionFr: "Cartonnée rigide, imprimée sur le plat, dos cousu. La plus durable.",
    descriptionMg: "Baoritra mafy, pirinty amin'ny fonony, voaisy fanjaitra. Maharitra indrindra.",
    extraPriceMga: 45_000,
  },
  {
    id: "souple",
    labelFr: "Couverture moyen solide",
    labelMg: "Fonony semi-rigide",
    descriptionFr: "Semi-rigide brillante, plus légère et moins chère, adaptée aux albums souvenirs.",
    descriptionMg: "Semi-rigide mazava, maivana sy mora vidy, mety amin'ny rakitsary fahatsiarovana.",
    extraPriceMga: 0,
  },
];

export type PhotobookSelection = {
  paper: PaperId;
  orientation: OrientationId;
  cover: CoverId;
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

export function selectionPriceMga(selection: PhotobookSelection): number {
  return findPaper(selection.paper).basePriceMga + findCover(selection.cover).extraPriceMga;
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

export function photobookLabel(selection: PhotobookSelection, locale: "fr" | "mg"): string {
  const paper = findPaper(selection.paper);
  const orientation = findOrientation(selection.orientation);
  const cover = findCover(selection.cover);
  const { widthMm, heightMm } = selectionSize(selection);

  const size = `${widthMm / 10} × ${heightMm / 10} cm`;
  const parts =
    locale === "mg"
      ? [paper.labelMg, orientation.labelMg, cover.labelMg]
      : [paper.labelFr.split(" — ")[0], orientation.labelFr, cover.labelFr];

  return `${parts.join(" · ")} — ${size}, ${PHOTOBOOK_PAGES} pages`;
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

/** Toutes les combinaisons vendables, dans un ordre stable. */
export function photobookVariantSeeds(): PhotobookVariantSeed[] {
  const seeds: PhotobookVariantSeed[] = [];

  PAPER_FORMATS.forEach((paper, paperIndex) => {
    ORIENTATIONS.forEach((orientation, orientationIndex) => {
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
          priceMga: selectionPriceMga(selection),
          // Le format le plus courant du marché local : A4 portrait, rigide.
          isDefault: paper.id === "a4" && orientation.id === "portrait" && cover.id === "rigide",
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
