import { MAX_CANVAS_SIDE } from "@/lib/editor/export";
import { emptyDocument, type EditorDocument } from "@/lib/editor/types";

/**
 * Plan de travail pour un format donné.
 *
 * Les pixels de travail restent proches d'une taille d'écran (1500 px de large
 * au maximum) : c'est le `pixelRatio` de l'export qui produit ensuite la
 * résolution d'impression à 300 dpi.
 */
export function makeInitialDocument(
  widthMm: number | null,
  heightMm: number | null,
  baseWidth = 1500,
  pageCount = 1,
): EditorDocument {
  if (!widthMm || !heightMm) {
    return emptyDocument(baseWidth, Math.round(baseWidth * 0.6667), pageCount);
  }

  const width = Math.min(baseWidth, MAX_CANVAS_SIDE);
  const height = Math.round((width * heightMm) / widthMm);

  return emptyDocument(width, height, pageCount);
}
