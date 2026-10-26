/**
 * Paiement statique du photobook.
 *
 * Aucune API de collecte n'est branchée pour le moment : le client envoie le
 * montant sur un numéro Mobile Money, indique le nom de son projet en motif,
 * puis saisit la référence de transaction reçue par SMS. Un administrateur
 * vérifie le relevé et valide la commande dans le back-office.
 *
 * Seuls MVOLA et Orange Money sont proposés. Les anciennes valeurs de
 * l'énumération restent acceptées en lecture pour ne pas casser les commandes
 * déjà enregistrées.
 */

export const PAYMENT_METHODS = ["MVOLA", "ORANGE_MONEY"] as const;

export type SupportedPaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Inclut les anciens moyens conservés pour l'historique des commandes. */
export type PaymentMethodValue =
  | SupportedPaymentMethod
  | "CASH_ON_DELIVERY"
  | "AIRTEL_MONEY"
  | "BANK_TRANSFER";

export type PaymentAccount = {
  number: string;
  holder: string;
  labelFr: string;
  labelMg: string;
};

/** Titulaire des deux comptes Mobile Money. */
export const PAYMENT_ACCOUNT_NAME = "RANAIVO Andry Ny Avo Onenantsoa";

export const PAYMENT_ACCOUNTS: Record<SupportedPaymentMethod, PaymentAccount> = {
  MVOLA: {
    number: "0389145273",
    holder: PAYMENT_ACCOUNT_NAME,
    labelFr: "MVola",
    labelMg: "MVola",
  },
  ORANGE_MONEY: {
    number: "0375441549",
    holder: PAYMENT_ACCOUNT_NAME,
    labelFr: "Orange Money",
    labelMg: "Orange Money",
  },
};

export function isSupportedPaymentMethod(
  value: unknown,
): value is SupportedPaymentMethod {
  return value === "MVOLA" || value === "ORANGE_MONEY";
}

/** Numéro à créditer pour un moyen de paiement. */
export function paymentTargetFor(method: PaymentMethodValue): string | null {
  if (isSupportedPaymentMethod(method)) {
    return PAYMENT_ACCOUNTS[method].number;
  }
  return null;
}

export function paymentAccountFor(
  method: PaymentMethodValue,
): PaymentAccount | null {
  return isSupportedPaymentMethod(method) ? PAYMENT_ACCOUNTS[method] : null;
}

/** Le client doit-il fournir une référence de transaction ? */
export function requiresTransactionReference(
  method: PaymentMethodValue,
): boolean {
  // Tous les moyens proposés aujourd'hui sont du Mobile Money déclaratif.
  return method !== "CASH_ON_DELIVERY";
}

export function initialPaymentStatus(
  method: PaymentMethodValue,
): "PENDING" | "AWAITING_VERIFICATION" {
  return method === "CASH_ON_DELIVERY" ? "PENDING" : "AWAITING_VERIFICATION";
}

/** La référence de transaction est-elle plausible ? (chiffres, lettres) */
export function isValidTransactionReference(value: string): boolean {
  const compact = value.replace(/[\s-]/g, "");
  return (
    compact.length >= 4 &&
    compact.length <= 32 &&
    /^[A-Za-z0-9]+$/.test(compact)
  );
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
    case "MVOLA":
      return "🟡";
    case "ORANGE_MONEY":
      return "🟠";
    case "AIRTEL_MONEY":
      return "🔴";
    case "CASH_ON_DELIVERY":
      return "💵";
    case "BANK_TRANSFER":
      return "🏦";
  }
}
