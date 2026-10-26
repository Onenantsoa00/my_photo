/**
 * Ce module ne touche pas au système de fichiers.
 *
 * Il est importé par des composants serveur (panier, compte, back-office) qui
 * n'ont besoin que de l'URL : garder `node:fs` dans un module séparé évite
 * d'embarquer le stockage disque dans leur graphe de dépendances.
 */
export function storageUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;

  const normalized = relativePath.split("\\").join("/").replace(/^\/+/, "");

  return `/api/files/${normalized}`;
}
