import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Connexion par WhatsApp : numéro de téléphone + code à 6 chiffres.
 *
 * WhatsApp n'expose pas de « Se connecter avec WhatsApp » : le seul moyen
 * officiel est d'envoyer un message via la WhatsApp Business Cloud API (Meta).
 * Le flux est donc celui d'un code à usage unique (OTP), avec trois garde-fous
 * côté serveur :
 *
 * - le code n'est **jamais** stocké en clair (HMAC-SHA256 avec `AUTH_SECRET`) ;
 * - il expire au bout de 5 minutes et n'est utilisable qu'une fois ;
 * - au-delà de 5 essais infructueux il est invalidé, et un même numéro est
 *   limité à 3 demandes par quart d'heure — sinon six chiffres se devinent.
 *
 * En développement, si aucun jeton WhatsApp n'est configuré, le code est
 * renvoyé à l'écran pour permettre de tester le parcours. En production, ce
 * comportement est désactivé et l'API répond « non configuré ».
 */

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_PHONE = 3;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Variables manquantes quand l'envoi n'est pas configuré. */
export function whatsappMissingEnv(): string[] {
  return ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"].filter((name) => !process.env[name]);
}

export function isDevelopmentCodeShown(): boolean {
  return process.env.NODE_ENV !== "production" && !whatsappConfigured();
}

/**
 * Normalisation d'un numéro malgache (ou international) vers `+261XXXXXXXXX`.
 * Renvoie `null` si le numéro n'est pas plausible.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[\s.\-()]/g, "");
  if (!/^\+?\d{7,15}$/.test(compact)) return null;

  let digits = compact.startsWith("+") ? compact.slice(1) : compact;

  if (digits.startsWith("00")) digits = digits.slice(2);

  // Format local : 0341234567 → +261341234567
  if (digits.startsWith("0")) {
    digits = `261${digits.slice(1)}`;
  } else if (!digits.startsWith("261") && digits.length <= 9) {
    digits = `261${digits}`;
  }

  if (!/^261\d{9}$/.test(digits)) return null;

  return `+${digits}`;
}

/** Affichage lisible : +261 34 12 345 67 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 12) return phone;

  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(
    7,
    10,
  )} ${digits.slice(10)}`;
}

function codeHash(phone: string, code: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant : impossible de hacher un code.");

  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type StartResult =
  | { ok: true; devCode?: string }
  | { ok: false; reason: "invalid_phone" | "too_many_requests" | "unavailable" };

/** Émet un code pour ce numéro et tente de l'envoyer par WhatsApp. */
export async function startWhatsappLogin(rawPhone: string): Promise<StartResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, reason: "invalid_phone" };

  const recent = await prisma.loginCode.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - RATE_WINDOW_MS) } },
  });

  if (recent >= MAX_CODES_PER_PHONE) {
    return { ok: false, reason: "too_many_requests" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await prisma.loginCode.create({
    data: {
      phone,
      codeHash: codeHash(phone, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  if (!whatsappConfigured()) {
    if (isDevelopmentCodeShown()) {
      console.warn(`[whatsapp] mode développement — code pour ${phone} : ${code}`);
      return { ok: true, devCode: code };
    }
    return { ok: false, reason: "unavailable" };
  }

  const sent = await sendWhatsappMessage(
    phone,
    `MyPhoto Mada : votre code de connexion est ${code}. Il expire dans 5 minutes.`,
  );

  if (!sent) return { ok: false, reason: "unavailable" };

  return { ok: true };
}

async function sendWhatsappMessage(phone: string, body: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return false;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone.replace("+", ""),
          type: "text",
          text: { body },
        }),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid_code" | "invalid_phone" };

/**
 * Vérifie le code et renvoie le compte correspondant, en le créant au besoin.
 *
 * Le compte créé n'a ni mot de passe ni adresse e-mail : le numéro vérifié fait
 * office d'identifiant. Un client qui a déjà un compte avec ce numéro y est
 * reconnecté (voir `User.phone`).
 */
export async function verifyWhatsappCode(
  rawPhone: string,
  code: string,
  options: { name?: string } = {},
): Promise<VerifyResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, reason: "invalid_phone" };
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "invalid_code" };

  const record = await prisma.loginCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, reason: "invalid_code" };

  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.loginCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "invalid_code" };
  }

  if (!safeEqual(record.codeHash, codeHash(phone, code))) {
    await prisma.loginCode.update({
      where: { id: record.id },
      data: { attempts: record.attempts + 1 },
    });
    return { ok: false, reason: "invalid_code" };
  }

  await prisma.loginCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  const user = await prisma.user.findFirst({
    where: { phone },
    orderBy: { createdAt: "asc" },
  });

  if (user) return { ok: true, userId: user.id };

  const name = options.name?.trim().slice(0, 80);

  const created = await prisma.user.create({
    data: {
      phone,
      name: name && name.length >= 2 ? name : "Client WhatsApp",
      email: null,
      passwordHash: null,
    },
  });

  return { ok: true, userId: created.id };
}
