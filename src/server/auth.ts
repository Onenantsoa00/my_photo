import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "mp_session";
/** Identifiant de panier pour les visiteurs non connectés. */
export const CART_COOKIE = "mp_cart";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

export type SessionRole = "CUSTOMER" | "ADMIN";

export type SessionUser = {
  id: string;
  /** `null` pour un compte créé uniquement par WhatsApp. */
  email: string | null;
  name: string;
  phone: string | null;
  role: SessionRole;
};

type SessionPayload = {
  sub: string;
  role: SessionRole;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET est manquant ou trop court (32 caractères minimum). Voir .env.example.",
    );
  }

  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Mots de passe
// ---------------------------------------------------------------------------

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Jetons de session
// ---------------------------------------------------------------------------

async function signSessionToken(userId: string, role: SessionRole): Promise<string> {
  return new SignJWT({ role } satisfies Omit<SessionPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

async function readSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    if (!payload.sub || (payload.role !== "CUSTOMER" && payload.role !== "ADMIN")) {
      return null;
    }

    return { sub: payload.sub, role: payload.role };
  } catch {
    // Jeton expiré, signature invalide ou cookie bricolé.
    return null;
  }
}

/**
 * Ouvre une session. À n'appeler que depuis une Server Action ou un Route
 * Handler : `cookies()` est en lecture seule dans les composants serveur.
 */
export async function createSession(userId: string, role: SessionRole): Promise<void> {
  const token = await signSessionToken(userId, role);
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Session courante, ou null. Recharge l'utilisateur pour refléter la base. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const payload = await readSessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, phone: true, role: true },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role as SessionRole,
  };
}

/**
 * Retrouve le compte correspondant à une identité externe.
 *
 * Sert aux connexions Google, Facebook et WhatsApp. L'e-mail prime sur le
 * téléphone ; l'absence de résultat laisse l'appelant décider de créer le
 * compte ou de refuser.
 */
export async function findUserForSocialLogin(where: {
  email?: string | null;
  phone?: string | null;
}) {
  if (where.email) {
    const byEmail = await prisma.user.findUnique({ where: { email: where.email } });
    if (byEmail) return byEmail;
  }

  if (where.phone) {
    // Le téléphone n'est pas unique (comptes de démonstration) : on retient le
    // plus ancien compte portant ce numéro, de façon déterministe.
    return prisma.user.findFirst({
      where: { phone: where.phone },
      orderBy: { createdAt: "asc" },
    });
  }

  return null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  return user;
}

// ---------------------------------------------------------------------------
// Panier invité
// ---------------------------------------------------------------------------

export async function getCartSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/** Renvoie l'identifiant de session panier, en le créant si nécessaire. */
export async function ensureCartSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;

  if (existing) return existing;

  const sessionId = crypto.randomUUID();
  store.set(CART_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return sessionId;
}
