/**
 * Modèle de document de l'atelier.
 *
 * Il est volontairement découplé de Konva : le document est du JSON sérialisable,
 * stocké tel quel dans `Design.document`, ce qui permet de le rejouer côté serveur
 * (aperçus) ou d'échanger le moteur de rendu sans migration de données.
 *
 * Version 2 : un photobook est un livre de plusieurs pages. Chaque page porte
 * son propre fond et ses propres calques, le plan de travail (largeur/hauteur)
 * restant commun à tout le livre.
 */

import { normalizeBackground, type PageBackground } from "@/lib/editor/background";

export const DOCUMENT_VERSION = 2;

export type ShapeKind = "rect" | "ellipse" | "triangle" | "star" | "line";

/** Découpe appliquée à une photo. « none » garde le cadre rectangulaire. */
export type ImageCrop = "none" | "rounded" | "circle" | "heart" | "star" | "diamond";

/**
 * Comment la photo occupe son cadre.
 *
 * - `cover`   : remplit le cadre et rogne le surplus (défaut des nouvelles photos) ;
 * - `contain` : montre la photo entière, quitte à laisser des marges ;
 * - `stretch` : étire la photo sur le cadre (comportement historique).
 *
 * Le client peut ensuite zoomer et déplacer la photo dans la forme.
 */
export type ImageFit = "cover" | "contain" | "stretch";

export type TextAlign = "left" | "center" | "right";

export type LayerBase = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
};

export type ImageFilters = {
  /** -1 à 1, appliqué par le filtre Brighten de Konva */
  brightness: number;
  /** -100 à 100, filtre Contrast de Konva */
  contrast: number;
  /** -1 à 5 (0 = neutre), filtre HSL de Konva */
  saturation: number;
  /** 0 à 40 px */
  blur: number;
  grayscale: boolean;
  sepia: boolean;
};

export const DEFAULT_FILTERS: ImageFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
  grayscale: false,
  sepia: false,
};

export type TextLayer = LayerBase & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: "normal" | "bold" | "italic";
  align: TextAlign;
  fill: string;
  lineHeight: number;
  letterSpacing: number;
};

export type ImageLayer = LayerBase & {
  type: "image";
  /** URL servie par /api/files/... ou data: URL après un import local. */
  src: string;
  /** Identifiant du fichier téléversé, pour rattacher la création à la photo. */
  uploadPath?: string;
  cornerRadius: number;
  /** Forme de découpe : cercle, cœur, étoile, losange… */
  crop: ImageCrop;
  /** Cadrage de la photo dans la forme. */
  fit: ImageFit;
  /** Zoom appliqué par-dessus le cadrage (1 = cadrage d'origine). */
  zoom: number;
  /** Déplacement de la photo dans son cadre, en pixels du plan de travail. */
  offsetX: number;
  offsetY: number;
  filters: ImageFilters;
};

export type ShapeLayer = LayerBase & {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
};

export type Layer = TextLayer | ImageLayer | ShapeLayer;

/** Une page du livre : fond + calques. */
export type EditorPage = {
  id: string;
  background: PageBackground;
  layers: Layer[];
};

export type EditorDocument = {
  version: number;
  canvas: {
    width: number;
    height: number;
    /** Référence du format commandé, pour retrouver le bon format à la reprise. */
    variantSku?: string;
  };
  pages: EditorPage[];
};

export type EditorDocumentInput = {
  version?: number;
  canvas?: Partial<EditorDocument["canvas"]> & { background?: string };
  pages?: unknown;
  /** Ancien format (version 1) : une seule page dans `layers`. */
  layers?: unknown;
};

export type EditorPageInput = {
  id?: unknown;
  background?: unknown;
  layers?: unknown;
};

export function createId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createPage(background: string | PageBackground = "#ffffff"): EditorPage {
  return { id: createId("page"), background: normalizeBackground(background), layers: [] };
}

export function emptyDocument(
  width = 1200,
  height = 800,
  pageCount = 1,
): EditorDocument {
  const count = Math.max(1, Math.trunc(pageCount) || 1);
  return {
    version: DOCUMENT_VERSION,
    canvas: { width, height },
    pages: Array.from({ length: count }, () => createPage()),
  };
}

/** Garantit un nombre minimum de pages (le photobook en exige 20). */
export function ensurePageCount(
  document: EditorDocument,
  minimumPages: number,
): EditorDocument {
  const minimum = Math.max(1, Math.trunc(minimumPages) || 1);
  if (document.pages.length >= minimum) return document;

  const background = document.pages[0]?.background;
  const missing = minimum - document.pages.length;

  return {
    ...document,
    pages: [
      ...document.pages,
      ...Array.from({ length: missing }, () => createPage(background)),
    ],
  };
}

/** Copie profonde d'une page, avec de nouveaux identifiants de calques. */
export function duplicatePage(page: EditorPage): EditorPage {
  return {
    id: createId("page"),
    background: page.background,
    layers: page.layers.map((layer) => ({
      ...layer,
      id: createId(layer.type),
      filters: layer.type === "image" ? { ...layer.filters } : undefined,
    })) as Layer[],
  };
}

export function countDocumentPages(input: unknown): number {
  if (!input || typeof input !== "object") return 1;
  const pages = (input as { pages?: unknown }).pages;
  if (Array.isArray(pages) && pages.length > 0) return pages.length;
  return 1;
}

export function documentHasContent(document: EditorDocument): boolean {
  return document.pages.some((page) => page.layers.length > 0);
}

/** Normalise un document venu du client ou de la base. */
export function normalizeDocument(
  input: unknown,
  fallbackWidth = 1200,
  fallbackHeight = 800,
  minimumPages = 1,
): EditorDocument {
  if (!input || typeof input !== "object") {
    return emptyDocument(fallbackWidth, fallbackHeight, minimumPages);
  }

  const candidate = input as EditorDocumentInput;
  const canvas: Partial<EditorDocument["canvas"]> & { background?: unknown } =
    candidate.canvas ?? {};

  const width = positiveNumber(canvas.width, fallbackWidth);
  const height = positiveNumber(canvas.height, fallbackHeight);
  const variantSku = typeof canvas.variantSku === "string" && canvas.variantSku
    ? canvas.variantSku
    : undefined;

  // Version 2 : pages explicites.
  let pages: EditorPage[] = Array.isArray(candidate.pages)
    ? candidate.pages.map((page) => normalizePage(page, canvas.background))
    : [];

  // Version 1 : un seul jeu de calques dans `document.layers`.
  if (pages.length === 0) {
    const legacyLayers = Array.isArray(candidate.layers)
      ? candidate.layers.filter(isLayer).map(withDefaults)
      : [];

    pages = [
      {
        id: createId("page"),
        background: normalizeBackground(canvas.background),
        layers: legacyLayers,
      },
    ];
  }

  const document: EditorDocument = {
    version: DOCUMENT_VERSION,
    canvas: { width, height, ...(variantSku ? { variantSku } : {}) },
    pages,
  };

  return ensurePageCount(document, minimumPages);
}

function normalizePage(value: unknown, fallbackBackground?: unknown): EditorPage {
  const candidate =
    value && typeof value === "object" ? (value as EditorPageInput) : {};

  return {
    id:
      typeof candidate.id === "string" && candidate.id
        ? candidate.id
        : createId("page"),
    background: normalizeBackground(candidate.background, fallbackBackground),
    layers: Array.isArray(candidate.layers)
      ? candidate.layers.filter(isLayer).map(withDefaults)
      : [],
  };
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function isLayer(value: unknown): value is Layer {
  if (!value || typeof value !== "object") return false;
  const type = (value as { type?: unknown }).type;
  return type === "text" || type === "image" || type === "shape";
}

function withDefaults(layer: Layer): Layer {
  const base = {
    id: typeof layer.id === "string" && layer.id ? layer.id : createId("layer"),
    name: typeof layer.name === "string" ? layer.name : labelFor(layer),
    x: numberOr(layer.x, 0),
    y: numberOr(layer.y, 0),
    width: Math.max(1, numberOr(layer.width, 100)),
    height: Math.max(1, numberOr(layer.height, 100)),
    rotation: numberOr(layer.rotation, 0),
    opacity: clamp(numberOr(layer.opacity, 1), 0, 1),
    visible: layer.visible !== false,
    locked: layer.locked === true,
  };

  if (layer.type === "text") {
    return {
      ...base,
      type: "text",
      text: typeof layer.text === "string" ? layer.text : "",
      fontFamily: layer.fontFamily || "Inter, sans-serif",
      fontSize: Math.max(4, numberOr(layer.fontSize, 48)),
      fontStyle:
        layer.fontStyle === "bold" || layer.fontStyle === "italic"
          ? layer.fontStyle
          : "normal",
      align:
        layer.align === "center" || layer.align === "right" ? layer.align : "left",
      fill: layer.fill || "#111827",
      lineHeight: numberOr(layer.lineHeight, 1.2),
      letterSpacing: numberOr(layer.letterSpacing, 0),
    };
  }

  if (layer.type === "image") {
    return {
      ...base,
      type: "image",
      src: typeof layer.src === "string" ? layer.src : "",
      uploadPath:
        typeof layer.uploadPath === "string" ? layer.uploadPath : undefined,
      cornerRadius: Math.max(0, numberOr(layer.cornerRadius, 0)),
      crop: isImageCrop(layer.crop) ? layer.crop : "none",
      // Les documents enregistrés avant l'ajustement gardent l'étirement :
      // l'apparence d'origine ne change pas.
      fit: isImageFit(layer.fit) ? layer.fit : "stretch",
      zoom: clamp(numberOr(layer.zoom, 1), 0.2, 8),
      offsetX: clamp(numberOr(layer.offsetX, 0), -4000, 4000),
      offsetY: clamp(numberOr(layer.offsetY, 0), -4000, 4000),
      filters: {
        brightness: clamp(numberOr(layer.filters?.brightness, 0), -1, 1),
        contrast: clamp(numberOr(layer.filters?.contrast, 0), -100, 100),
        saturation: clamp(numberOr(layer.filters?.saturation, 0), -1, 5),
        blur: clamp(numberOr(layer.filters?.blur, 0), 0, 40),
        grayscale: layer.filters?.grayscale === true,
        sepia: layer.filters?.sepia === true,
      },
    };
  }

  return {
    ...base,
    type: "shape",
    shape: isShapeKind(layer.shape) ? layer.shape : "rect",
    fill: layer.fill || "#2563eb",
    stroke: layer.stroke || "transparent",
    strokeWidth: Math.max(0, numberOr(layer.strokeWidth, 0)),
    cornerRadius: Math.max(0, numberOr(layer.cornerRadius, 0)),
  };
}

function isShapeKind(value: unknown): value is ShapeKind {
  return (
    value === "rect" ||
    value === "ellipse" ||
    value === "triangle" ||
    value === "star" ||
    value === "line"
  );
}

export function isImageFit(value: unknown): value is ImageFit {
  return value === "cover" || value === "contain" || value === "stretch";
}

/**
 * Cadrage réel d'une photo dans son cadre.
 *
 * Le nœud Konva garde la taille du cadre : c'est la zone de la source
 * (`crop`) qui bouge, ce qui permet de zoomer et de déplacer la photo dans un
 * cadre en forme de cœur, d'étoile ou de cercle sans jamais le déborder.
 */
export function imageLayout(
  layer: Pick<ImageLayer, "width" | "height" | "fit" | "zoom" | "offsetX" | "offsetY">,
  natural: { width: number; height: number },
): {
  node: { x: number; y: number; width: number; height: number };
  source: { x: number; y: number; width: number; height: number };
} {
  const boxWidth = Math.max(1, layer.width);
  const boxHeight = Math.max(1, layer.height);
  const naturalWidth = natural.width > 0 ? natural.width : boxWidth;
  const naturalHeight = natural.height > 0 ? natural.height : boxHeight;
  const fit = layer.fit ?? "stretch";
  const zoom = clamp(layer.zoom ?? 1, 0.2, 8);
  const offsetX = layer.offsetX ?? 0;
  const offsetY = layer.offsetY ?? 0;

  if (fit === "cover") {
    // Fenêtre source au format du cadre, la plus grande possible.
    const targetAspect = boxWidth / boxHeight;
    let sourceWidth = naturalWidth;
    let sourceHeight = naturalWidth / targetAspect;

    if (sourceHeight > naturalHeight) {
      sourceHeight = naturalHeight;
      sourceWidth = naturalHeight * targetAspect;
    }

    sourceWidth = Math.max(1, sourceWidth / zoom);
    sourceHeight = Math.max(1, sourceHeight / zoom);

    const maxX = Math.max(0, naturalWidth - sourceWidth);
    const maxY = Math.max(0, naturalHeight - sourceHeight);
    // Un déplacement positif à l'écran déplace la fenêtre source en sens inverse.
    const centerX =
      naturalWidth / 2 - (offsetX / boxWidth) * sourceWidth;
    const centerY =
      naturalHeight / 2 - (offsetY / boxHeight) * sourceHeight;

    return {
      node: { x: 0, y: 0, width: boxWidth, height: boxHeight },
      source: {
        x: clamp(centerX - sourceWidth / 2, 0, maxX),
        y: clamp(centerY - sourceHeight / 2, 0, maxY),
        width: sourceWidth,
        height: sourceHeight,
      },
    };
  }

  if (fit === "contain") {
    const ratio = Math.min(naturalWidth / boxWidth, naturalHeight / boxHeight);
    const drawnWidth = (naturalWidth / ratio) * zoom;
    const drawnHeight = (naturalHeight / ratio) * zoom;
    const shiftX = clamp(offsetX, -boxWidth / 2, boxWidth / 2);
    const shiftY = clamp(offsetY, -boxHeight / 2, boxHeight / 2);

    return {
      node: {
        x: (boxWidth - drawnWidth) / 2 + shiftX,
        y: (boxHeight - drawnHeight) / 2 + shiftY,
        width: drawnWidth,
        height: drawnHeight,
      },
      source: { x: 0, y: 0, width: naturalWidth, height: naturalHeight },
    };
  }

  // `stretch` : toute la photo est déformée sur le cadre, le zoom agrandit
  // depuis le centre.
  const drawnWidth = boxWidth * zoom;
  const drawnHeight = boxHeight * zoom;
  const shiftX = clamp(offsetX, -boxWidth / 2, boxWidth / 2);
  const shiftY = clamp(offsetY, -boxHeight / 2, boxHeight / 2);

  return {
    node: {
      x: -(drawnWidth - boxWidth) / 2 + shiftX,
      y: -(drawnHeight - boxHeight) / 2 + shiftY,
      width: drawnWidth,
      height: drawnHeight,
    },
    source: { x: 0, y: 0, width: naturalWidth, height: naturalHeight },
  };
}

export function isImageCrop(value: unknown): value is ImageCrop {
  return (
    value === "none" ||
    value === "rounded" ||
    value === "circle" ||
    value === "heart" ||
    value === "star" ||
    value === "diamond"
  );
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function labelFor(layer: Layer): string {
  if (layer.type === "text") {
    return layer.text.slice(0, 28) || "Texte";
  }
  if (layer.type === "image") return "Photo";
  return `Forme · ${layer.shape}`;
}
