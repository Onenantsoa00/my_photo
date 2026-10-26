/**
 * Calcul de la résolution d'export.
 *
 * L'atelier travaille à une résolution d'écran confortable (par exemple
 * 1500 × 1000 px pour un tirage 10 × 15). Pour l'impression, on réexporte le
 * plan de travail avec un `pixelRatio` qui amène la largeur à 300 dpi sur le
 * support réel : 150 mm / 25,4 × 300 = 1772 px.
 */

export const PRINT_DPI = 300;
export const MM_PER_INCH = 25.4;

export function mmToPixels(mm: number, dpi = PRINT_DPI): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type ExportInfo = {
  /** Facteur appliqué à la taille du plan de travail. */
  pixelRatio: number;
  widthPx: number;
  heightPx: number;
  /** Taille d'impression réelle. */
  widthCm: number;
  heightCm: number;
  /** Résolution réellement atteinte, arrondie. */
  effectiveDpi: number;
  /** true si le plan de travail est trop petit pour du 300 dpi net. */
  lowResolution: boolean;
};

/**
 * Konva refuse des images au-delà de ~16384 px de côté sur la plupart des
 * navigateurs : on plafonne le facteur pour éviter un canvas vide.
 */
export const MAX_PIXEL_RATIO = 8;
export const MAX_CANVAS_SIDE = 16000;

export function computeExportInfo(
  canvasWidth: number,
  canvasHeight: number,
  targetWidthMm: number | null,
  targetHeightMm: number | null,
  dpi = PRINT_DPI,
): ExportInfo {
  const widthCm = targetWidthMm ? targetWidthMm / 10 : canvasWidth / 10;
  const heightCm = targetHeightMm ? targetHeightMm / 10 : canvasHeight / 10;

  if (!targetWidthMm) {
    const pixelRatio = 2;
    return {
      pixelRatio,
      widthPx: Math.round(canvasWidth * pixelRatio),
      heightPx: Math.round(canvasHeight * pixelRatio),
      widthCm,
      heightCm,
      effectiveDpi: 0,
      lowResolution: false,
    };
  }

  const desiredWidthPx = mmToPixels(targetWidthMm, dpi);
  const desiredHeightPx = targetHeightMm ? mmToPixels(targetHeightMm, dpi) : null;

  let pixelRatio = desiredWidthPx / canvasWidth;

  if (desiredHeightPx) {
    // On prend le facteur le plus contraignant des deux axes.
    pixelRatio = Math.max(pixelRatio, desiredHeightPx / canvasHeight);
  }

  const cappedByRatio = clamp(pixelRatio, 1, MAX_PIXEL_RATIO);
  const cappedBySide = clamp(
    MAX_CANVAS_SIDE / Math.max(canvasWidth, canvasHeight),
    1,
    MAX_PIXEL_RATIO,
  );
  const appliedRatio = Math.min(cappedByRatio, cappedBySide);

  const widthPx = Math.round(canvasWidth * appliedRatio);
  const heightPx = Math.round(canvasHeight * appliedRatio);
  const effectiveDpi = Math.round((widthPx / targetWidthMm) * MM_PER_INCH);

  return {
    pixelRatio: appliedRatio,
    widthPx,
    heightPx,
    widthCm,
    heightCm,
    effectiveDpi,
    // En dessous de 200 dpi l'impression devient visiblement molle.
    lowResolution: effectiveDpi < 200,
  };
}

/** Déclenche le téléchargement d'une data URL côté navigateur. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function safeFilename(title: string, extension: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);

  return `${base || "creation"}.${extension}`;
}
