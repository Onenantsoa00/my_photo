/**
 * Modèle de document de l'atelier.
 *
 * Il est volontairement découplé de Konva : le document est du JSON sérialisable,
 * stocké tel quel dans `Design.document`, ce qui permet de le rejouer côté serveur
 * (aperçus) ou d'échanger le moteur de rendu sans migration de données.
 */

export const DOCUMENT_VERSION = 1;

export type ShapeKind = "rect" | "ellipse" | "triangle" | "star" | "line";

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

export type EditorDocument = {
  version: number;
  canvas: {
    width: number;
    height: number;
    background: string;
  };
  layers: Layer[];
};

export type EditorDocumentInput = Partial<EditorDocument> & {
  canvas?: Partial<EditorDocument["canvas"]>;
};

export function emptyDocument(width = 1200, height = 800): EditorDocument {
  return {
    version: DOCUMENT_VERSION,
    canvas: { width, height, background: "#ffffff" },
    layers: [],
  };
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `layer_${Math.random().toString(36).slice(2, 10)}`;
}

/** Normalise un document venu du client ou de la base. */
export function normalizeDocument(
  input: unknown,
  fallbackWidth = 1200,
  fallbackHeight = 800,
): EditorDocument {
  if (!input || typeof input !== "object") {
    return emptyDocument(fallbackWidth, fallbackHeight);
  }

  const candidate = input as EditorDocumentInput;
  const canvas: Partial<EditorDocument["canvas"]> = candidate.canvas ?? {};

  const layers = Array.isArray(candidate.layers)
    ? candidate.layers.filter(isLayer).map(withDefaults)
    : [];

  return {
    version: DOCUMENT_VERSION,
    canvas: {
      width: positiveNumber(canvas.width, fallbackWidth),
      height: positiveNumber(canvas.height, fallbackHeight),
      background:
        typeof canvas.background === "string" ? canvas.background : "#ffffff",
    },
    layers,
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
    id: typeof layer.id === "string" && layer.id ? layer.id : createId(),
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
      fontStyle: layer.fontStyle === "bold" || layer.fontStyle === "italic"
        ? layer.fontStyle
        : "normal",
      align: layer.align === "center" || layer.align === "right" ? layer.align : "left",
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
      uploadPath: typeof layer.uploadPath === "string" ? layer.uploadPath : undefined,
      cornerRadius: Math.max(0, numberOr(layer.cornerRadius, 0)),
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
