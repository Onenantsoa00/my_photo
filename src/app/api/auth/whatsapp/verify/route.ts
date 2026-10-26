import { NextResponse } from "next/server";

import { sanitizeReturnTo } from "@/lib/return-to";
import { createSession } from "@/server/auth";
import { mergeGuestCartIntoUser } from "@/server/cart";
import { prisma } from "@/lib/prisma";
import { verifyWhatsappCode } from "@/server/whatsapp";

/**
 * Vérifie le code reçu sur WhatsApp, ouvre la session et indique où continuer.
 *
 * Le compte est créé au besoin : un client peut donc s'inscrire *et* se
 * connecter par le même écran, comme avec Google.
 */
export async function POST(request: Request) {
  let payload: { phone?: unknown; code?: unknown; name?: unknown; next?: unknown };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ errorKey: "auth.whatsappCodeInvalid" }, { status: 400 });
  }

  const phone = typeof payload.phone === "string" ? payload.phone : "";
  const code = typeof payload.code === "string" ? payload.code.trim() : "";
  const name = typeof payload.name === "string" ? payload.name : undefined;

  if (phone.length > 32 || code.length > 12) {
    return NextResponse.json({ errorKey: "auth.whatsappCodeInvalid" }, { status: 400 });
  }

  const result = await verifyWhatsappCode(phone, code, { name });

  if (!result.ok) {
    return NextResponse.json(
      {
        errorKey:
          result.reason === "invalid_phone"
            ? "auth.whatsappPhoneInvalid"
            : "auth.whatsappCodeInvalid",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { id: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ errorKey: "auth.oauthFailed" }, { status: 400 });
  }

  await createSession(user.id, user.role === "ADMIN" ? "ADMIN" : "CUSTOMER");
  await mergeGuestCartIntoUser(user.id);

  const next = sanitizeReturnTo(payload.next);

  return NextResponse.json({
    ok: true,
    redirect: next ?? (user.role === "ADMIN" ? "/admin" : "/compte"),
  });
}
