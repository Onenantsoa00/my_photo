import {
  DEFAULT_FILTERS,
  DOCUMENT_VERSION,
  createId,
  createPage,
  type EditorDocument,
  type ImageCrop,
  type ImageLayer,
  type Layer,
  type ShapeLayer,
  type TextLayer,
} from "@/lib/editor/types";

export type Template = {
  id: string;
  nameFr: string;
  nameMg: string;
  descriptionFr: string;
  /** Facultatif : à défaut, la description française est affichée. */
  descriptionMg?: string;
  targetWidthMm: number;
  targetHeightMm: number;
  build: () => EditorDocument;
};

export const FONT_STACKS: { label: string; value: string }[] = [
  { label: "Moderne", value: "Inter, system-ui, -apple-system, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Affiche", value: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { label: "Machine", value: "'Courier New', ui-monospace, monospace" },
  { label: "Impact", value: "Impact, 'Arial Black', sans-serif" },
];

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

// ---------------------------------------------------------------------------
// Fabriques de calques
// ---------------------------------------------------------------------------

export function makeTextLayer(overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    id: id("text"),
    name: "Texte",
    type: "text",
    x: 120,
    y: 120,
    width: 600,
    height: 120,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    text: "Votre texte",
    fontFamily: FONT_STACKS[0].value,
    fontSize: 64,
    fontStyle: "bold",
    align: "left",
    fill: "#111827",
    lineHeight: 1.15,
    letterSpacing: 0,
    ...overrides,
  };
}

export function makeImageLayer(overrides: Partial<ImageLayer> = {}): ImageLayer {
  return {
    id: id("image"),
    name: "Photo",
    type: "image",
    x: 120,
    y: 120,
    width: 500,
    height: 400,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    src: "",
    cornerRadius: 0,
    crop: "none",
    filters: { ...DEFAULT_FILTERS },
    ...overrides,
  };
}

export function makeShapeLayer(overrides: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    id: id("shape"),
    name: "Forme",
    type: "shape",
    shape: "rect",
    x: 120,
    y: 120,
    width: 300,
    height: 300,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fill: "#f97316",
    stroke: "transparent",
    strokeWidth: 0,
    cornerRadius: 0,
    ...overrides,
  };
}

/**
 * Les pixels du plan de travail restent proches d'une taille d'écran : on ne
 * travaille pas à la résolution d'impression, la conversion en 300 dpi est
 * faite au moment de l'export (voir lib/editor/export.ts).
 */
function doc(
  width: number,
  height: number,
  background: string,
  layers: Layer[],
): EditorDocument {
  return {
    version: DOCUMENT_VERSION,
    canvas: { width, height },
    pages: [
      {
        ...createPage(background),
        layers: layers.map((layer) => ({
          ...layer,
          id: layer.id || createId(layer.type),
        })),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Modèles de photobook A4
// ---------------------------------------------------------------------------

export const TEMPLATES: Template[] = [
  {
    id: "pb-couverture",
    nameFr: "Couverture",
    nameMg: "Fonony",
    descriptionFr: "Page de couverture : titre du livre et photo centrale.",
    descriptionMg: "Pejy fonony : lohatenin'ny boky sy sary lehibe eo afovoany.",
    targetWidthMm: 210,
    targetHeightMm: 297,
    build: () =>
      doc(1500, 2121, "#0f172a", [
        makeImageLayer({ x: 150, y: 300, width: 1200, height: 1050, cornerRadius: 8 }),
        makeTextLayer({
          x: 150,
          y: 1450,
          width: 1200,
          height: 180,
          text: "Ny tantarako",
          fontSize: 128,
          align: "center",
          fill: "#ffffff",
        }),
        makeShapeLayer({
          name: "Filet",
          shape: "rect",
          x: 650,
          y: 1690,
          width: 200,
          height: 8,
          fill: "#1f9e69",
        }),
        makeTextLayer({
          x: 150,
          y: 1760,
          width: 1200,
          height: 110,
          text: "2016 — 2026",
          fontSize: 54,
          fontStyle: "normal",
          align: "center",
          fill: "#cbd5e1",
        }),
      ]),
  },
  {
    id: "pb-grille-4",
    nameFr: "Grille de 4 photos",
    nameMg: "Sary efatra",
    descriptionFr: "Quatre photos et un titre : la page la plus rapide à remplir.",
    descriptionMg: "Sary efatra sy lohateny : pejy haingana indrindra fenoina.",
    targetWidthMm: 210,
    targetHeightMm: 297,
    build: () =>
      doc(1500, 2121, "#ffffff", [
        makeTextLayer({
          x: 90,
          y: 80,
          width: 1320,
          height: 120,
          text: "Fahatsiarovana",
          fontSize: 82,
          fill: "#0f172a",
        }),
        makeImageLayer({ x: 90, y: 260, width: 640, height: 640 }),
        makeImageLayer({ x: 770, y: 260, width: 640, height: 640 }),
        makeImageLayer({ x: 90, y: 940, width: 640, height: 640 }),
        makeImageLayer({ x: 770, y: 940, width: 640, height: 640 }),
        makeTextLayer({
          x: 90,
          y: 1660,
          width: 1320,
          height: 120,
          text: "Antananarivo",
          fontSize: 54,
          fontStyle: "normal",
          align: "center",
          fill: "#475569",
        }),
      ]),
  },
  {
    id: "pb-recit",
    nameFr: "Récit",
    nameMg: "Tantara",
    descriptionFr: "Une grande photo, deux vignettes et un texte pour raconter une journée.",
    descriptionMg: "Sary lehibe, sary kely roa sy soratra mitantara ny andro iray.",
    targetWidthMm: 297,
    targetHeightMm: 210,
    build: () =>
      doc(2121, 1500, "#f8fafc", [
        makeImageLayer({ x: 100, y: 100, width: 1100, height: 1300 }),
        makeImageLayer({ x: 1260, y: 100, width: 760, height: 620 }),
        makeImageLayer({ x: 1260, y: 780, width: 760, height: 620 }),
        makeTextLayer({
          x: 100,
          y: 1260,
          width: 1100,
          height: 140,
          text: "Isan'andro",
          fontSize: 72,
          fill: "#0f172a",
        }),
      ]),
  },
  {
    id: "pb-mariage",
    nameFr: "Mariage",
    nameMg: "Famakaram-bady",
    descriptionFr: "Deux photos, les prénoms et la date, sur fond ivoire.",
    descriptionMg: "Sary roa, anarana sy daty, amin'ny fototra ivoire.",
    targetWidthMm: 210,
    targetHeightMm: 297,
    build: () =>
      doc(1500, 2121, "#fffbf5", [
        makeShapeLayer({
          name: "Filet haut",
          shape: "rect",
          x: 90,
          y: 90,
          width: 1320,
          height: 6,
          fill: "#b45309",
        }),
        makeImageLayer({ x: 90, y: 200, width: 1320, height: 900 }),
        makeTextLayer({
          x: 90,
          y: 1180,
          width: 1320,
          height: 160,
          text: "Hery & Miora",
          fontSize: 104,
          align: "center",
          fill: "#7c2d12",
        }),
        makeTextLayer({
          x: 90,
          y: 1350,
          width: 1320,
          height: 90,
          text: "12 septambra 2026",
          fontSize: 48,
          fontStyle: "normal",
          align: "center",
          fill: "#92400e",
        }),
        makeImageLayer({ x: 90, y: 1500, width: 640, height: 500 }),
        makeImageLayer({ x: 770, y: 1500, width: 640, height: 500 }),
      ]),
  },
  {
    id: "pb-voyage",
    nameFr: "Voyage",
    nameMg: "Dia",
    descriptionFr: "Trois photos de voyage et le nom du lieu.",
    descriptionMg: "Sary telo sy anaran'ny toerana.",
    targetWidthMm: 297,
    targetHeightMm: 210,
    build: () =>
      doc(2121, 1500, "#ecfeff", [
        makeImageLayer({ x: 100, y: 100, width: 1920, height: 800 }),
        makeImageLayer({ x: 100, y: 940, width: 900, height: 460 }),
        makeImageLayer({ x: 1120, y: 940, width: 900, height: 460 }),
        makeTextLayer({
          x: 100,
          y: 120,
          width: 700,
          height: 110,
          text: "Nosy Be",
          fontSize: 76,
          fill: "#ffffff",
        }),
      ]),
  },
  {
    id: "pb-bebe",
    nameFr: "Bébé",
    nameMg: "Zaza",
    descriptionFr: "Photo ronde, fond pastel et prénom.",
    descriptionMg: "Sary boribory, fototra pastel sy anarana.",
    targetWidthMm: 210,
    targetHeightMm: 297,
    build: () =>
      doc(1500, 2121, "#fdf2f8", [
        makeShapeLayer({
          name: "Cercle",
          shape: "ellipse",
          x: 350,
          y: 350,
          width: 800,
          height: 800,
          fill: "#fbcfe8",
        }),
        makeImageLayer({
          x: 400,
          y: 400,
          width: 700,
          height: 700,
          crop: "circle",
        }),
        makeTextLayer({
          x: 150,
          y: 1320,
          width: 1200,
          height: 150,
          text: "Soa hery",
          fontSize: 96,
          align: "center",
          fill: "#9d174d",
        }),
      ]),
  },
  {
    id: "pb-fete",
    nameFr: "Fête",
    nameMg: "Fety",
    descriptionFr: "Bandeau coloré et deux photos pour un anniversaire.",
    descriptionMg: "Tâche miloko sy sary roa ho an'ny tsingerintaona.",
    targetWidthMm: 210,
    targetHeightMm: 297,
    build: () =>
      doc(1500, 2121, "#ffffff", [
        makeShapeLayer({
          name: "Bandeau",
          shape: "rect",
          x: 0,
          y: 0,
          width: 1500,
          height: 320,
          fill: "#e2372f",
        }),
        makeTextLayer({
          x: 90,
          y: 90,
          width: 1320,
          height: 160,
          text: "Tratrin'ny taona !",
          fontSize: 96,
          align: "center",
          fill: "#ffffff",
        }),
        makeImageLayer({ x: 90, y: 420, width: 1320, height: 900 }),
        makeImageLayer({ x: 90, y: 1400, width: 640, height: 560 }),
        makeImageLayer({ x: 770, y: 1400, width: 640, height: 560 }),
      ]),
  },
  {
    id: "pb-page-simple",
    nameFr: "Page simple",
    nameMg: "Pejy tsotra",
    descriptionFr: "Une photo plein cadre et une légende discrète.",
    descriptionMg: "Sary feno ny pejy sy fanamarihana kely.",
    targetWidthMm: 210,
    targetHeightMm: 297,
    build: () =>
      doc(1500, 2121, "#ffffff", [
        makeImageLayer({ x: 0, y: 0, width: 1500, height: 1800 }),
        makeTextLayer({
          x: 90,
          y: 1880,
          width: 1320,
          height: 120,
          text: "Ny fahatsiarovana tsara indrindra",
          fontSize: 46,
          fontStyle: "normal",
          align: "center",
          fill: "#64748b",
        }),
      ]),
  },
  {
    id: "pb-formes",
    nameFr: "Cœurs & formes",
    nameMg: "Fo sy endrika",
    descriptionFr: "Trois photos découpées en cœur, cercle et losange.",
    descriptionMg: "Sary telo voatapaka amin'ny fo, boribory sy efajoro.",
    targetWidthMm: 210,
    targetHeightMm: 297,
    build: () =>
      doc(1500, 2121, "#fff7ed", [
        makeTextLayer({
          x: 90,
          y: 100,
          width: 1320,
          height: 120,
          text: "Amour & souvenirs",
          fontSize: 78,
          align: "center",
          fill: "#9a3412",
        }),
        makeImageLayer({
          x: 150,
          y: 330,
          width: 540,
          height: 540,
          crop: "heart" as ImageCrop,
        }),
        makeImageLayer({
          x: 810,
          y: 330,
          width: 540,
          height: 540,
          crop: "circle" as ImageCrop,
        }),
        makeImageLayer({
          x: 380,
          y: 980,
          width: 740,
          height: 740,
          crop: "diamond" as ImageCrop,
        }),
        makeTextLayer({
          x: 150,
          y: 1800,
          width: 1200,
          height: 120,
          text: "Ho anao mandrakizay",
          fontSize: 52,
          fontStyle: "normal",
          align: "center",
          fill: "#c2410c",
        }),
      ]),
  },
];

// ---------------------------------------------------------------------------
// Thèmes
// ---------------------------------------------------------------------------

/**
 * Un thème n'est pas un modèle de plus : c'est un regroupement qui filtre la
 * liste des modèles. L'assistant `/creer` s'en sert pour proposer « un thème »
 * sans imposer une mise en page unique.
 */
export type Theme = {
  id: string;
  nameFr: string;
  nameMg: string;
  descriptionFr: string;
  descriptionMg: string;
  emoji: string;
  /** Identifiants de modèles, dans l'ordre de pertinence. */
  templateIds: string[];
};

export const THEMES: Theme[] = [
  {
    id: "famille",
    nameFr: "Famille",
    nameMg: "Fianakaviana",
    descriptionFr: "Grilles de portraits et souvenirs de famille.",
    descriptionMg: "Sary mitovy sy fahatsiarovana fianakaviana.",
    emoji: "👨‍👩‍👧‍👦",
    templateIds: ["pb-grille-4", "pb-recit", "pb-page-simple", "pb-couverture"],
  },
  {
    id: "mariage",
    nameFr: "Mariage",
    nameMg: "Famakaram-bady",
    descriptionFr: "Couverture, prénoms et grandes photos du jour J.",
    descriptionMg: "Fonony, anarana sy sary lehibe.",
    emoji: "💍",
    templateIds: ["pb-mariage", "pb-couverture", "pb-page-simple"],
  },
  {
    id: "voyage",
    nameFr: "Voyage",
    nameMg: "Dia",
    descriptionFr: "Paysages en pleine page et récits de trajet.",
    descriptionMg: "Tontolo malalaka sy tantaram-pitetezana.",
    emoji: "✈️",
    templateIds: ["pb-voyage", "pb-recit", "pb-grille-4"],
  },
  {
    id: "bebe",
    nameFr: "Bébé",
    nameMg: "Zaza",
    descriptionFr: "Tons doux pour les premières années.",
    descriptionMg: "Loko malefaka ho an'ny taona voalohany.",
    emoji: "🍼",
    templateIds: ["pb-bebe", "pb-page-simple", "pb-grille-4"],
  },
  {
    id: "fete",
    nameFr: "Fête & anniversaire",
    nameMg: "Fety sy tsingerintaona",
    descriptionFr: "Couleurs vives pour les événements.",
    descriptionMg: "Loko mamirapiratra ho an'ny hetsika.",
    emoji: "🎉",
    templateIds: ["pb-fete", "pb-grille-4", "pb-formes"],
  },
];

export function findTheme(themeId: string): Theme | undefined {
  return THEMES.find((theme) => theme.id === themeId);
}

/** Modèles d'un thème, résolus et filtrés sur ceux qui existent vraiment. */
export function templatesForTheme(themeId: string): Template[] {
  const theme = findTheme(themeId);
  if (!theme) return [];

  return theme.templateIds
    .map((templateId) => findTemplate(templateId))
    .filter((template): template is Template => Boolean(template));
}

export function findTemplate(templateId: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === templateId);
}

/**
 * Adapte une composition à un nouveau plan de travail (par exemple le format
 * réellement commandé) : mise à l'échelle uniforme puis recentrage, pour ne pas
 * déformer les textes ni rogner les calques.
 */
export function fitDocument(
  document: EditorDocument,
  width: number,
  height: number,
): EditorDocument {
  const { canvas, pages } = document;

  if (canvas.width === width && canvas.height === height) return document;

  const scale = Math.min(width / canvas.width, height / canvas.height);
  const offsetX = (width - canvas.width * scale) / 2;
  const offsetY = (height - canvas.height * scale) / 2;

  const scaledPages = pages.map((page) => ({
    ...page,
    layers: page.layers.map(
      (layer) =>
        ({
          ...layer,
          x: offsetX + layer.x * scale,
          y: offsetY + layer.y * scale,
          width: Math.max(1, layer.width * scale),
          height: Math.max(1, layer.height * scale),
          ...(layer.type === "text"
            ? { fontSize: Math.max(4, layer.fontSize * scale) }
            : {}),
          ...(layer.type === "image"
            ? { cornerRadius: layer.cornerRadius * scale }
            : {}),
          ...(layer.type === "shape"
            ? {
                cornerRadius: layer.cornerRadius * scale,
                strokeWidth: layer.strokeWidth * scale,
              }
            : {}),
        }) as Layer,
    ),
  }));

  return {
    ...document,
    canvas: { ...canvas, width, height },
    pages: scaledPages,
  };
}
