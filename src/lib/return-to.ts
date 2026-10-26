/**
 * Retour vers la page demandée après connexion.
 *
 * Le paramètre `next` vient de l'URL : il est donc fourni par le client. Sans
 * validation, `?next=https://exemple.test` transformerait la connexion en
 * redirection ouverte — un lien de phishing crédible puisque le domaine est le
 * nôtre. Seuls les chemins internes sont acceptés.
 */
export function sanitizeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > 300) return null;

  // Un chemin interne commence par un seul « / ». « //hote » et « /\hote »
  // sont interprétés comme des URL absolues par les navigateurs.
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.includes("\\")) return null;

  // Caractères de contrôle : coupures de ligne dans un en-tête Location.
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;

  return value;
}

/** URL de connexion conservant la destination. */
export function signInUrl(returnTo: string): string {
  const safe = sanitizeReturnTo(returnTo);
  return safe ? `/connexion?next=${encodeURIComponent(safe)}` : "/connexion";
}

/** URL d'inscription conservant la destination. */
export function signUpUrl(returnTo: string): string {
  const safe = sanitizeReturnTo(returnTo);
  return safe ? `/inscription?next=${encodeURIComponent(safe)}` : "/inscription";
}
