/**
 * Fond d'une page.
 *
 * Trois familles, toutes exprimées par une valeur structurée (et non par une
 * simple chaîne CSS) pour que le rendu Konva — celui qui part réellement à
 * l'impression — et le rendu DOM des vignettes restent identiques :
 *
 * - `solid`   : une couleur unie ;
 * - `gradient`: un dégradé linéaire dont l'utilisateur choisit les deux
 *               couleurs et la direction ;
 * - `pattern` : un motif répété (points, grille, rayures…) dont l'utilisateur
 *               choisit la couleur, le fond et la taille.
 *
 * `backgroundToCss` sert aux vignettes (barre de pages, aperçus de modèles),
 * `gradientEndpoints` et `patternTile` au canevas d'impression.
 */

import type { TranslationKey } from "@/lib/i18n";

export type BackgroundPatternId =
  | "dots"
  | "grid"
  | "stripes"
  | "diagonal"
  | "checker"
  | "flowers"
  | "floral"
  | "monogram"
  | "gold"
  | "hearts"
  | "stars"
  | "leaves"
  | "waves"
  | "deco"
  | "marble";

export type BackgroundSolid = {
  kind: "solid";
  color: string;
};

export type BackgroundGradient = {
  kind: "gradient";
  from: string;
  to: string;
  /** Angle CSS, en degrés : 0 = vers le haut, 180 = vers le bas. */
  angle: number;
};

export type BackgroundPattern = {
  kind: "pattern";
  pattern: BackgroundPatternId;
  /** Couleur du motif. */
  color: string;
  /** Couleur de fond sur laquelle le motif est posé. */
  surface: string;
  /** Taille de la répétition, en pixels de plan de travail. */
  size: number;
};

export type PageBackground = BackgroundSolid | BackgroundGradient | BackgroundPattern;

/** Choix proposés dans l'atelier, avec leur clé de traduction. */
export const BACKGROUND_PATTERNS: {
  id: BackgroundPatternId;
  key: TranslationKey;
}[] = [
  { id: "dots", key: "editor.pattern.dots" },
  { id: "grid", key: "editor.pattern.grid" },
  { id: "stripes", key: "editor.pattern.stripes" },
  { id: "diagonal", key: "editor.pattern.diagonal" },
  { id: "checker", key: "editor.pattern.checker" },
  { id: "flowers", key: "editor.pattern.flowers" },
  { id: "floral", key: "editor.pattern.floral" },
  { id: "monogram", key: "editor.pattern.monogram" },
  { id: "gold", key: "editor.pattern.gold" },
  { id: "hearts", key: "editor.pattern.hearts" },
  { id: "stars", key: "editor.pattern.stars" },
  { id: "leaves", key: "editor.pattern.leaves" },
  { id: "waves", key: "editor.pattern.waves" },
  { id: "deco", key: "editor.pattern.deco" },
  { id: "marble", key: "editor.pattern.marble" },
];

/** Directions proposées pour le dégradé (angles CSS). */
export const GRADIENT_ANGLES: { angle: number; key: TranslationKey; arrow: string }[] = [
  { angle: 180, key: "editor.gradient.down", arrow: "↓" },
  { angle: 90, key: "editor.gradient.right", arrow: "→" },
  { angle: 45, key: "editor.gradient.upRight", arrow: "↗" },
  { angle: 135, key: "editor.gradient.downRight", arrow: "↘" },
];

/** Tailles de motif proposées, en pixels de plan de travail. */
export const PATTERN_SIZES: { size: number; key: TranslationKey }[] = [
  { size: 32, key: "editor.bgSizeSmall" },
  { size: 64, key: "editor.bgSizeMedium" },
  { size: 128, key: "editor.bgSizeLarge" },
];

export function defaultBackground(color = "#ffffff"): PageBackground {
  return { kind: "solid", color };
}

function colorOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 && value.length < 40
    ? value
    : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Accepte une couleur (anciens documents) ou une description structurée.
 * Tout ce qui n'est pas reconnu retombe sur le fond blanc par défaut.
 */
export function normalizeBackground(
  value: unknown,
  fallback?: unknown,
): PageBackground {
  if (typeof value === "string" && value.trim()) {
    return { kind: "solid", color: value.trim() };
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;

    if (candidate.kind === "solid") {
      return { kind: "solid", color: colorOr(candidate.color, "#ffffff") };
    }

    if (candidate.kind === "gradient") {
      return {
        kind: "gradient",
        from: colorOr(candidate.from, "#e2e8f0"),
        to: colorOr(candidate.to, "#ffffff"),
        angle: Math.round(numberOr(candidate.angle, 180)) % 360,
      };
    }

    if (candidate.kind === "pattern") {
      const known = BACKGROUND_PATTERNS.some((item) => item.id === candidate.pattern);
      return {
        kind: "pattern",
        pattern: known ? (candidate.pattern as BackgroundPatternId) : "dots",
        color: colorOr(candidate.color, "#cbd5e1"),
        surface: colorOr(candidate.surface, "#ffffff"),
        size: Math.min(256, Math.max(8, Math.round(numberOr(candidate.size, 64)))),
      };
    }
  }

  // Une valeur héritée (autre champ de repli) reste utilisable.
  if (fallback !== undefined && fallback !== null) {
    return normalizeBackground(fallback);
  }

  return defaultBackground();
}

/** Couleur unie manipulable par un sélecteur de couleur. */
export function backgroundBaseColor(background: PageBackground): string {
  if (background.kind === "gradient") return background.from;
  if (background.kind === "pattern") return background.surface;
  return background.color;
}

/** Équivalent CSS, pour les vignettes rendues en DOM. */
export function backgroundToCss(background: PageBackground): string {
  if (background.kind === "solid") return background.color;

  if (background.kind === "gradient") {
    return `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`;
  }

  const { pattern, color, surface, size } = background;
  const half = Math.max(2, Math.round(size / 2));
  const dot = Math.max(1, Math.round(size / 8));
  const stroke = Math.max(1, Math.round(size / 10));
  // Espacement perpendiculaire des bandes diagonales de période `size`.
  const diagonal = Math.max(4, Math.round(size * 0.7071));

  // Les motifs décoratifs sont décrits en SVG : le même dessin sert à la
  // vignette DOM et, en miroir, à la tuile du canevas d'impression.
  switch (pattern) {
    case "flowers":
      return svgTile(flowerTile(size, color, surface), size, surface);
    case "floral":
      return svgTile(floralTile(size, color, surface), size, surface);
    case "monogram":
      return svgTile(monogramTile(size, color, surface), size, surface);
    case "gold":
      return svgTile(goldTile(size, color, surface), size, surface);
    case "hearts":
      return svgTile(heartsTile(size, color, surface), size, surface);
    case "stars":
      return svgTile(starsTile(size, color, surface), size, surface);
    case "leaves":
      return svgTile(leavesTile(size, color, surface), size, surface);
    case "waves":
      return svgTile(wavesTile(size, color, surface), size, surface);
    case "deco":
      return svgTile(decoTile(size, color, surface), size, surface);
    case "marble":
      return svgTile(marbleTile(size, color, surface), size, surface);
    case "grid":
      return (
        `repeating-linear-gradient(90deg, ${color} 0 1px, transparent 1px ${size}px), ` +
        `repeating-linear-gradient(0deg, ${color} 0 1px, transparent 1px ${size}px), ` +
        surface
      );
    case "stripes":
      return (
        `repeating-linear-gradient(180deg, ${color} 0 ${half}px, ` +
        `${surface} ${half}px ${size}px)`
      );
    case "diagonal":
      return (
        `repeating-linear-gradient(45deg, ${color} 0 ${stroke}px, ` +
        `${surface} ${stroke}px ${stroke + diagonal}px)`
      );
    case "checker":
      return (
        `repeating-conic-gradient(${color} 0% 25%, ${surface} 0% 50%) ` +
        `0 0 / ${size * 2}px ${size * 2}px`
      );
    default:
      return (
        `radial-gradient(circle, ${color} ${dot}px, transparent ${dot}px) ` +
        `0 0 / ${size}px ${size}px, ${surface}`
      );
  }
}

/**
 * Extrémités du dégradé pour Konva, dans le repère du plan de travail.
 * Même convention que CSS : 0° vers le haut, sens horaire.
 */
export function gradientEndpoints(
  background: BackgroundGradient,
  width: number,
  height: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const radians = (background.angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const cx = width / 2;
  const cy = height / 2;

  return {
    x1: cx - (dx * length) / 2,
    y1: cy - (dy * length) / 2,
    x2: cx + (dx * length) / 2,
    y2: cy + (dy * length) / 2,
  };
}

/**
 * Tuile répétée du motif, dessinée hors écran puis posée par Konva via
 * `fillPatternImage`. N'appelle `document` que côté navigateur : la scène est
 * chargée en `ssr: false`.
 */
export function patternTile(background: BackgroundPattern): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;

  const size = Math.max(8, Math.round(background.size));
  const canvas = document.createElement("canvas");
  const checker = background.pattern === "checker";
  const side = checker ? size * 2 : size;

  canvas.width = side;
  canvas.height = side;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = background.surface;
  ctx.fillRect(0, 0, side, side);
  ctx.fillStyle = background.color;

  switch (background.pattern) {
    case "dots": {
      ctx.beginPath();
      ctx.arc(side / 2, side / 2, Math.max(1.5, size / 8), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "grid": {
      ctx.fillRect(0, 0, side, 1);
      ctx.fillRect(0, 0, 1, side);
      break;
    }
    case "stripes": {
      ctx.fillRect(0, 0, side, Math.max(2, Math.round(size / 2)));
      break;
    }
    case "diagonal": {
      ctx.strokeStyle = background.color;
      ctx.lineWidth = Math.max(1, Math.round(size / 10));
      // Famille de droites y = k·taille − x : une ligne par période, les
      // coins assurant la continuité d'une tuile à l'autre.
      for (const offset of [0, size, size * 2]) {
        ctx.beginPath();
        ctx.moveTo(0, offset);
        ctx.lineTo(side, offset - side);
        ctx.stroke();
      }
      break;
    }
    case "checker": {
      ctx.fillRect(size, 0, size, size);
      ctx.fillRect(0, size, size, size);
      break;
    }
    case "flowers": {
      drawFlower(ctx, side / 2, side / 2, size, background.color, background.surface, 5);
      break;
    }
    case "floral": {
      drawFlower(ctx, side / 2, side / 2, size, background.color, background.surface, 8);
      ctx.fillStyle = background.color;
      ctx.globalAlpha = 0.5;
      drawLeaf(ctx, size * 0.12, size * 0.14, size * 0.7, size * 0.22);
      drawLeaf(ctx, size * 0.86, size * 0.88, size * 0.7, size * 0.22 + Math.PI);
      ctx.globalAlpha = 1;
      break;
    }
    case "monogram": {
      ctx.strokeStyle = background.color;
      ctx.lineWidth = Math.max(1, size * 0.035);
      ctx.beginPath();
      ctx.moveTo(size / 2, size * 0.06);
      ctx.lineTo(size * 0.94, size / 2);
      ctx.lineTo(size / 2, size * 0.94);
      ctx.lineTo(size * 0.06, size / 2);
      ctx.closePath();
      ctx.globalAlpha = 0.45;
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(size * 0.38, size / 2, size * 0.2, Math.PI * 0.35, Math.PI * 1.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(size * 0.62, size / 2, size * 0.2, Math.PI * 1.35, Math.PI * 0.75);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.035, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "gold": {
      const gradient = ctx.createLinearGradient(0, 0, side, side);
      gradient.addColorStop(0, background.surface);
      gradient.addColorStop(0.38, background.surface);
      gradient.addColorStop(0.5, background.color);
      gradient.addColorStop(0.62, background.surface);
      gradient.addColorStop(1, background.surface);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, side, side);
      ctx.fillStyle = background.color;
      ctx.globalAlpha = 0.65;
      for (const [x, y, r] of GOLD_FLECKS) {
        ctx.beginPath();
        ctx.arc(x * size, y * size, Math.max(0.8, r * size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "hearts": {
      drawHeart(ctx, size / 2, size / 2, size * 0.46);
      ctx.globalAlpha = 0.35;
      drawHeart(ctx, size * 0.06, size * 0.08, size * 0.16);
      drawHeart(ctx, size * 0.94, size * 0.92, size * 0.16);
      ctx.globalAlpha = 1;
      break;
    }
    case "stars": {
      drawStar(ctx, size / 2, size / 2, size * 0.3, size * 0.13, 5);
      ctx.globalAlpha = 0.4;
      drawStar(ctx, size * 0.08, size * 0.88, size * 0.1, size * 0.045, 5);
      drawStar(ctx, size * 0.9, size * 0.12, size * 0.08, size * 0.035, 5);
      ctx.globalAlpha = 1;
      break;
    }
    case "leaves": {
      drawLeaf(ctx, size / 2, size / 2, size * 0.78, size * 0.3);
      ctx.globalAlpha = 0.5;
      drawLeaf(ctx, size * 0.1, size * 0.9, size * 0.5, size * 0.2);
      drawLeaf(ctx, size * 0.9, size * 0.1, size * 0.5, size * 0.2 + Math.PI);
      ctx.globalAlpha = 1;
      break;
    }
    case "waves": {
      ctx.strokeStyle = background.color;
      ctx.lineWidth = Math.max(1, size * 0.05);
      for (const offset of [-size, 0, size]) {
        ctx.beginPath();
        ctx.moveTo(0, size * 0.5 + offset);
        ctx.bezierCurveTo(
          size * 0.25, size * 0.2 + offset,
          size * 0.25, size * 0.8 + offset,
          size * 0.5, size * 0.5 + offset,
        );
        ctx.bezierCurveTo(
          size * 0.75, size * 0.2 + offset,
          size * 0.75, size * 0.8 + offset,
          size, size * 0.5 + offset,
        );
        ctx.stroke();
      }
      break;
    }
    case "deco": {
      ctx.strokeStyle = background.color;
      ctx.lineWidth = Math.max(1, size * 0.03);
      for (let index = 0; index <= 6; index += 1) {
        const angle = Math.PI + (Math.PI / 6) * index;
        ctx.beginPath();
        ctx.moveTo(size / 2, size * 0.92);
        ctx.lineTo(
          size / 2 + Math.cos(angle) * size * 0.55,
          size * 0.92 + Math.sin(angle) * size * 0.55,
        );
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(size / 2, size * 0.92, size * 0.22, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = background.color;
      ctx.beginPath();
      ctx.arc(size / 2, size * 0.92, size * 0.04, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "marble": {
      ctx.fillStyle = background.surface;
      ctx.fillRect(0, 0, side, side);
      ctx.strokeStyle = background.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = Math.max(1, size * 0.014);
      for (const offset of [0, 0.45]) {
        ctx.beginPath();
        ctx.moveTo(0, size * (0.3 + offset));
        ctx.bezierCurveTo(
          size * 0.3, size * (0.15 + offset),
          size * 0.45, size * (0.55 + offset),
          size * 0.75, size * (0.4 + offset),
        );
        ctx.bezierCurveTo(
          size * 0.9, size * (0.32 + offset),
          size * 0.95, size * (0.6 + offset),
          size, size * (0.45 + offset),
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Motifs décoratifs : SVG (vignettes) et primitives canvas (impression)
// ---------------------------------------------------------------------------

/** Quelques paillettes dorées, positions stables d'une tuile à l'autre. */
const GOLD_FLECKS: [number, number, number][] = [
  [0.16, 0.22, 0.022],
  [0.32, 0.68, 0.016],
  [0.58, 0.12, 0.018],
  [0.74, 0.48, 0.024],
  [0.47, 0.86, 0.014],
  [0.9, 0.74, 0.02],
  [0.08, 0.52, 0.012],
];

function svgTile(svg: string, size: number, surface: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 0 0 / ${size}px ${size}px repeat, ${surface}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function flowerTile(size: number, color: string, surface: string): string {
  const center = size / 2;
  const petals = [0, 72, 144, 216, 288]
    .map(
      (angle) =>
        `<ellipse cx="${round(center)}" cy="${round(center - size * 0.19)}" rx="${round(size * 0.11)}" ry="${round(size * 0.18)}" transform="rotate(${angle} ${round(center)} ${round(center)})"/>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="${color}" opacity="0.9">${petals}<circle cx="${round(center)}" cy="${round(center)}" r="${round(size * 0.055)}" fill="${surface}"/><circle cx="${round(size * 0.08)}" cy="${round(size * 0.1)}" r="${round(size * 0.025)}"/><circle cx="${round(size * 0.9)}" cy="${round(size * 0.88)}" r="${round(size * 0.025)}"/></g></svg>`;
}

function floralTile(size: number, color: string, surface: string): string {
  const center = size / 2;
  const petals = Array.from({ length: 8 }, (_, index) => index * 45)
    .map(
      (angle) =>
        `<ellipse cx="${round(center)}" cy="${round(center - size * 0.22)}" rx="${round(size * 0.09)}" ry="${round(size * 0.22)}" transform="rotate(${angle} ${round(center)} ${round(center)})"/>`,
    )
    .join("");
  const leaves =
    `<path d="M ${round(size * 0.06)} ${round(size * 0.2)} C ${round(size * 0.22)} ${round(size * 0.05)}, ${round(size * 0.34)} ${round(size * 0.12)}, ${round(size * 0.3)} ${round(size * 0.3)} C ${round(size * 0.2)} ${round(size * 0.34)}, ${round(size * 0.1)} ${round(size * 0.32)}, ${round(size * 0.06)} ${round(size * 0.2)} Z" opacity="0.45"/>` +
    `<path d="M ${round(size * 0.94)} ${round(size * 0.8)} C ${round(size * 0.78)} ${round(size * 0.95)}, ${round(size * 0.66)} ${round(size * 0.88)}, ${round(size * 0.7)} ${round(size * 0.7)} C ${round(size * 0.8)} ${round(size * 0.66)}, ${round(size * 0.9)} ${round(size * 0.68)}, ${round(size * 0.94)} ${round(size * 0.8)} Z" opacity="0.45"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="${color}" opacity="0.85">${petals}${leaves}<circle cx="${round(center)}" cy="${round(center)}" r="${round(size * 0.08)}" fill="${surface}"/><circle cx="${round(center)}" cy="${round(center)}" r="${round(size * 0.035)}"/></g></svg>`;
}

function monogramTile(size: number, color: string, surface: string): string {
  const stroke = Math.max(1, size * 0.035);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="none" stroke="${color}" stroke-width="${round(stroke)}" opacity="0.9"><path d="M ${round(size * 0.5)} ${round(size * 0.06)} L ${round(size * 0.94)} ${round(size * 0.5)} L ${round(size * 0.5)} ${round(size * 0.94)} L ${round(size * 0.06)} ${round(size * 0.5)} Z" opacity="0.4"/><path d="M ${round(size * 0.38)} ${round(size * 0.62)} A ${round(size * 0.2)} ${round(size * 0.2)} 0 1 1 ${round(size * 0.38)} ${round(size * 0.38)}"/><path d="M ${round(size * 0.62)} ${round(size * 0.38)} A ${round(size * 0.2)} ${round(size * 0.2)} 0 1 1 ${round(size * 0.62)} ${round(size * 0.62)}"/></g><circle cx="${round(size * 0.5)}" cy="${round(size * 0.5)}" r="${round(size * 0.035)}" fill="${color}"/></svg>`;
}

function goldTile(size: number, color: string, surface: string): string {
  const flecks = GOLD_FLECKS.map(
    ([x, y, r]) =>
      `<circle cx="${round(x * size)}" cy="${round(y * size)}" r="${round(Math.max(0.8, r * size))}"/>`,
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${surface}"/><stop offset="38%" stop-color="${color}" stop-opacity="0.35"/><stop offset="50%" stop-color="${color}" stop-opacity="0.85"/><stop offset="62%" stop-color="${surface}"/><stop offset="100%" stop-color="${surface}"/></linearGradient></defs><rect width="${size}" height="${size}" fill="url(#gold)"/><g fill="${color}" opacity="0.7">${flecks}</g></svg>`;
}

function heartTilePath(size: number): string {
  return `M ${round(size * 0.5)} ${round(size * 0.78)} C ${round(size * 0.08)} ${round(size * 0.48)}, ${round(size * 0.12)} ${round(size * 0.12)}, ${round(size * 0.5)} ${round(size * 0.3)} C ${round(size * 0.88)} ${round(size * 0.12)}, ${round(size * 0.92)} ${round(size * 0.48)}, ${round(size * 0.5)} ${round(size * 0.78)} Z`;
}

function heartsTile(size: number, color: string, surface: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="${color}"><path d="${heartTilePath(size)}" opacity="0.9"/><path d="M ${round(size * 0.08)} ${round(size * 0.2)} C ${round(size * 0.02)} ${round(size * 0.13)}, ${round(size * 0.02)} ${round(size * 0.04)}, ${round(size * 0.08)} ${round(size * 0.07)} C ${round(size * 0.14)} ${round(size * 0.04)}, ${round(size * 0.14)} ${round(size * 0.13)}, ${round(size * 0.08)} ${round(size * 0.2)} Z" opacity="0.4"/><path d="M ${round(size * 0.92)} ${round(size * 0.95)} C ${round(size * 0.86)} ${round(size * 0.88)}, ${round(size * 0.86)} ${round(size * 0.79)}, ${round(size * 0.92)} ${round(size * 0.82)} C ${round(size * 0.98)} ${round(size * 0.79)}, ${round(size * 0.98)} ${round(size * 0.88)}, ${round(size * 0.92)} ${round(size * 0.95)} Z" opacity="0.4"/></g></svg>`;
}

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    return `${round(cx + Math.cos(angle) * radius)},${round(cy + Math.sin(angle) * radius)}`;
  }).join(" ");
}

function starsTile(size: number, color: string, surface: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="${color}"><polygon points="${starPoints(size / 2, size / 2, size * 0.3, size * 0.13)}" opacity="0.9"/><polygon points="${starPoints(size * 0.08, size * 0.88, size * 0.1, size * 0.045)}" opacity="0.45"/><polygon points="${starPoints(size * 0.9, size * 0.12, size * 0.08, size * 0.035)}" opacity="0.45"/></g></svg>`;
}

function leavesTile(size: number, color: string, surface: string): string {
  const leaf =
    `M ${round(size * 0.5)} ${round(size * 0.12)} C ${round(size * 0.82)} ${round(size * 0.32)}, ${round(size * 0.82)} ${round(size * 0.62)}, ${round(size * 0.5)} ${round(size * 0.88)} C ${round(size * 0.18)} ${round(size * 0.62)}, ${round(size * 0.18)} ${round(size * 0.32)}, ${round(size * 0.5)} ${round(size * 0.12)} Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="${color}"><path d="${leaf}" opacity="0.75"/><path d="M ${round(size * 0.5)} ${round(size * 0.18)} L ${round(size * 0.5)} ${round(size * 0.84)}" stroke="${surface}" stroke-width="${round(size * 0.02)}" fill="none" opacity="0.5"/><path d="M ${round(size * 0.04)} ${round(size * 0.7)} C ${round(size * 0.18)} ${round(size * 0.56)}, ${round(size * 0.28)} ${round(size * 0.64)}, ${round(size * 0.24)} ${round(size * 0.86)} C ${round(size * 0.12)} ${round(size * 0.9)}, ${round(size * 0.04)} ${round(size * 0.84)}, ${round(size * 0.04)} ${round(size * 0.7)} Z" opacity="0.35"/><path d="M ${round(size * 0.96)} ${round(size * 0.3)} C ${round(size * 0.82)} ${round(size * 0.16)}, ${round(size * 0.72)} ${round(size * 0.24)}, ${round(size * 0.76)} ${round(size * 0.46)} C ${round(size * 0.88)} ${round(size * 0.5)}, ${round(size * 0.96)} ${round(size * 0.44)}, ${round(size * 0.96)} ${round(size * 0.3)} Z" opacity="0.35"/></g></svg>`;
}

function wavesTile(size: number, color: string, surface: string): string {
  const wave = (offset: number) =>
    `M 0 ${round(size * 0.5 + offset)} C ${round(size * 0.25)} ${round(size * 0.2 + offset)}, ${round(size * 0.25)} ${round(size * 0.8 + offset)}, ${round(size * 0.5)} ${round(size * 0.5 + offset)} S ${round(size * 0.75)} ${round(size * 0.2 + offset)}, ${round(size)} ${round(size * 0.5 + offset)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="none" stroke="${color}" stroke-width="${round(Math.max(1, size * 0.05))}"><path d="${wave(-size)}"/><path d="${wave(0)}"/><path d="${wave(size)}"/></g></svg>`;
}

function decoTile(size: number, color: string, surface: string): string {
  const rays = Array.from({ length: 7 }, (_, index) => {
    const angle = Math.PI + (Math.PI / 6) * index;
    return `<line x1="${round(size / 2)}" y1="${round(size * 0.92)}" x2="${round(size / 2 + Math.cos(angle) * size * 0.55)}" y2="${round(size * 0.92 + Math.sin(angle) * size * 0.55)}"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="none" stroke="${color}" stroke-width="${round(Math.max(1, size * 0.03))}" opacity="0.9">${rays}<path d="M ${round(size * 0.28)} ${round(size * 0.92)} A ${round(size * 0.22)} ${round(size * 0.22)} 0 0 1 ${round(size * 0.72)} ${round(size * 0.92)}"/></g><circle cx="${round(size / 2)}" cy="${round(size * 0.92)}" r="${round(size * 0.04)}" fill="${color}"/></svg>`;
}

function marbleTile(size: number, color: string, surface: string): string {
  const vein = (offset: number) =>
    `M 0 ${round(size * (0.3 + offset))} C ${round(size * 0.3)} ${round(size * (0.15 + offset))}, ${round(size * 0.45)} ${round(size * (0.55 + offset))}, ${round(size * 0.75)} ${round(size * (0.4 + offset))} S ${round(size * 0.95)} ${round(size * (0.6 + offset))}, ${round(size)} ${round(size * (0.45 + offset))}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${surface}"/><g fill="none" stroke="${color}" stroke-width="${round(Math.max(1, size * 0.014))}" opacity="0.4"><path d="${vein(0)}"/><path d="${vein(0.45)}"/></g></svg>`;
}

function drawFlower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  surface: string,
  petals: number,
) {
  ctx.fillStyle = color;
  for (let index = 0; index < petals; index += 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((index * Math.PI * 2) / petals);
    ctx.beginPath();
    ctx.ellipse(
      0,
      -size * 0.19,
      size * 0.105,
      size * 0.185,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = surface;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.055, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.32);
  ctx.bezierCurveTo(
    cx - size * 0.75,
    cy - size * 0.05,
    cx - size * 0.42,
    cy - size * 0.62,
    cx,
    cy - size * 0.24,
  );
  ctx.bezierCurveTo(
    cx + size * 0.42,
    cy - size * 0.62,
    cx + size * 0.75,
    cy - size * 0.05,
    cx,
    cy + size * 0.32,
  );
  ctx.closePath();
  ctx.fill();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
) {
  ctx.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  rotation: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, -length / 2);
  ctx.bezierCurveTo(
    length * 0.32,
    -length * 0.2,
    length * 0.32,
    length * 0.2,
    0,
    length / 2,
  );
  ctx.bezierCurveTo(
    -length * 0.32,
    length * 0.2,
    -length * 0.32,
    -length * 0.2,
    0,
    -length / 2,
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
