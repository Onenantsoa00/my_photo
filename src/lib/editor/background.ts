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

export type BackgroundPatternId = "dots" | "grid" | "stripes" | "diagonal" | "checker";

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

  switch (pattern) {
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
  }

  return canvas;
}
