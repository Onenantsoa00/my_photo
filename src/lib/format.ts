const MGA_NUMBER = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

/**
 * Les montants sont stockés en Ariary entiers (la devise n'a pas de
 * subdivision en circulation). Ex. 25000 -> "25 000 Ar"
 */
export function formatMga(amount: number): string {
  return `${MGA_NUMBER.format(Math.round(amount)).replace(/[\u202f\u00a0]/g, " ")} Ar`;
}

export function formatDate(value: Date | string, locale = "fr-FR"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: Date | string, locale = "fr-FR"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** "10 × 15 cm" à partir d'une dimension en millimètres. */
export function formatCm(mm: number): string {
  const cm = mm / 10;
  return `${Number.isInteger(cm) ? cm : cm.toFixed(1).replace(".", ",")} cm`;
}

/** "12 × 18 cm" */
export function formatDimensions(widthMm: number, heightMm: number): string {
  return `${formatCm(widthMm)} × ${formatCm(heightMm)}`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count > 1 ? plural : singular;
}

/** Ratio largeur/hauteur à partir de millimètres, utile pour l'éditeur. */
export function ratioFromMm(widthMm: number, heightMm: number): number {
  return widthMm / heightMm;
}
