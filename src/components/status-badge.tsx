import { translate, type Locale, type TranslationKey } from "@/lib/i18n";

const ORDER_TONE: Record<string, string> = {
  PENDING: "badge-warn",
  CONFIRMED: "badge-brand",
  IN_PRODUCTION: "badge-brand",
  READY_FOR_PICKUP: "badge-brand",
  SHIPPED: "badge-brand",
  DELIVERED: "badge-brand",
  CANCELLED: "badge-danger",
};

const PAYMENT_TONE: Record<string, string> = {
  PENDING: "badge-warn",
  AWAITING_VERIFICATION: "badge-warn",
  PAID: "badge-brand",
  FAILED: "badge-danger",
  REFUNDED: "badge-neutral",
};

export function StatusBadge({
  kind,
  value,
  locale,
}: {
  kind: "order" | "payment";
  value: string;
  locale: Locale;
}) {
  const tone =
    (kind === "order" ? ORDER_TONE[value] : PAYMENT_TONE[value]) ?? "badge-neutral";

  const key = (kind === "order" ? `status.${value}` : `paymentStatus.${value}`) as TranslationKey;

  return <span className={tone}>{translate(locale, key)}</span>;
}
