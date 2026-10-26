import { NextResponse } from "next/server";

import type { TranslationKey } from "@/lib/i18n";
import { startWhatsappLogin } from "@/server/whatsapp";

const REASONS: Record<string, TranslationKey> = {
  invalid_phone: "auth.whatsappPhoneInvalid",
  too_many_requests: "auth.whatsappTooMany",
  unavailable: "auth.whatsappUnavailable",
};

/** Envoie un code de connexion à 6 chiffres sur le WhatsApp du client. */
export async function POST(request: Request) {
  let payload: { phone?: unknown };

  try {
    payload = (await request.json()) as { phone?: unknown };
  } catch {
    return NextResponse.json({ errorKey: "auth.whatsappPhoneInvalid" }, { status: 400 });
  }

  const phone = typeof payload.phone === "string" ? payload.phone : "";

  if (phone.length > 32) {
    return NextResponse.json({ errorKey: "auth.whatsappPhoneInvalid" }, { status: 400 });
  }

  const result = await startWhatsappLogin(phone);

  if (!result.ok) {
    const status = result.reason === "invalid_phone" ? 400 : result.reason === "too_many_requests" ? 429 : 503;
    return NextResponse.json({ errorKey: REASONS[result.reason] }, { status });
  }

  // `devCode` n'est renseigné qu'en développement, quand aucun fournisseur
  // WhatsApp n'est branché (voir src/server/whatsapp.ts).
  return NextResponse.json({ ok: true, devCode: result.devCode });
}
