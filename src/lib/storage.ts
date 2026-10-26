import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "storage/uploads";

/** Racine absolue du stockage, quel que soit le répertoire de travail. */
export function storageRoot(): string {
  // `turbopackIgnore` : le dossier est lu depuis l'environnement, le bundler ne
  // peut pas le résoudre statiquement et tracerait tout le projet.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), UPLOAD_DIR);
}

/**
 * Convertit un chemin relatif en chemin absolu, en refusant toute tentative de
 * sortie du répertoire de stockage (`../../etc/passwd`).
 */
export function resolveStoragePath(relativePath: string): string {
  const root = storageRoot();
  const normalized = path
    .normalize(relativePath)
    .replace(/^([/\\])+/, "")
    .replace(/^(\.\.[/\\])+/, "");

  // `turbopackIgnore` : le chemin est volontairement dynamique (nom de fichier
  // fourni par l'URL). Sans ce marqueur, le bundler croit devoir embarquer tout
  // le projet pour couvrir les chemins possibles.
  const absolute = path.resolve(/* turbopackIgnore: true */ root, normalized);

  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new Error("Chemin de stockage invalide");
  }

  return absolute;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export const ALLOWED_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

export function extensionForMime(mime: string): string | null {
  return EXTENSION_BY_MIME[mime] ?? null;
}

/** Chemin relatif daté : 2026/10/<uuid>.jpg — évite les dossiers géants. */
export function buildRelativePath(extension: string, prefix = ""): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const name = `${prefix}${randomUUID()}.${extension}`;

  return path.posix.join(String(year), month, name);
}

export async function writeStorageFile(
  relativePath: string,
  data: Buffer | Uint8Array,
): Promise<string> {
  const absolute = resolveStoragePath(relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
  return relativePath;
}

/** Signature courte utilisée pour les noms de fichiers dérivés (aperçus). */
export function shortHash(input: string | Buffer | Uint8Array): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 10);
}
