/**
 * Configuration des moyens de paiement.
 *
 * Il n'existe pas d'agrégateur unique couvrant MVola, Orange Money et Airtel
 * Money à Madagascar : chacun demande un contrat marchand séparé. Le flux
 * retenu est donc « Mobile Money déclaratif » — le client envoie l'argent au
 * numéro marchand puis saisit son numéro de transaction, qu'un administrateur
 * vérifie dans le back-office. Le passage à une API de collecte automatique
 * consiste à remplacer `initialPaymentStatus` et à ajouter un webhook.
 */

export const PAYMENT_METHODS = [
  "CASH_ON_DELIVERY",
  "MVOLA",
  "ORANGE_MONEY",
  "AIRTEL_MONEY",
  "BANK_TRANSFER",
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

/** Numéro / compte à créditer, affiché au client. */
export function paymentTargetFor(method: PaymentMethodValue): string | null {
  switch (method) {
    case "MVOLA":
      return process.env.PAYMENT_MVOLA_NUMBER ?? null;
    case "ORANGE_MONEY":
      return process.env.PAYMENT_ORANGE_MONEY_NUMBER ?? null;
    case "AIRTEL_MONEY":
      return process.env.PAYMENT_AIRTEL_MONEY_NUMBER ?? null;
    case "BANK_TRANSFER":
      return process.env.PAYMENT_BANK_IBAN ?? null;
    case "CASH_ON_DELIVERY":
      return null;
  }
}

/** Le client doit-il fournir un numéro de transaction ? */
export function requiresTransactionReference(method: PaymentMethodValue): boolean {
  return method !== "CASH_ON_DELIVERY";
}

export function initialPaymentStatus(
  method: PaymentMethodValue,
): "PENDING" | "AWAITING_VERIFICATION" {
  return method === "CASH_ON_DELIVERY" ? "PENDING" : "AWAITING_VERIFICATION";
}

/** Le numéro de transaction est-il plausible ? (chiffres, espaces, tirets) */
export function isValidTransactionReference(value: string): boolean {
  const compact = value.replace(/[\s-]/g, "");
  return compact.length >= 4 && compact.length <= 32 && /^[A-Za-z0-9]+$/.test(compact);
}

export const PAYMENT_METHOD_LABEL_KEY: Record<
  PaymentMethodValue,
  | "paymentMethod.CASH_ON_DELIVERY"
  | "paymentMethod.MVOLA"
  | "paymentMethod.ORANGE_MONEY"
  | "paymentMethod.AIRTEL_MONEY"
  | "paymentMethod.BANK_TRANSFER"
> = {
  CASH_ON_DELIVERY: "paymentMethod.CASH_ON_DELIVERY",
  MVOLA: "paymentMethod.MVOLA",
  ORANGE_MONEY: "paymentMethod.ORANGE_MONEY",
  AIRTEL_MONEY: "paymentMethod.AIRTEL_MONEY",
  BANK_TRANSFER: "paymentMethod.BANK_TRANSFER",
};

export function paymentMethodIcon(method: PaymentMethodValue): string {
  switch (method) {
    case "CASH_ON_DELIVERY":
      return "💵";
    case "MVOLA":
      return "🟡";
    case "ORANGE_MONEY":
      return "🟠";
    case "AIRTEL_MONEY":
      return "🔴";
    case "BANK_TRANSFER":
      return "🏦";
  }
}
