"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { TranslationKey } from "@/lib/i18n";
import { sanitizeReturnTo } from "@/lib/return-to";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/server/auth";
import { mergeGuestCartIntoUser } from "@/server/cart";

export type AuthState = {
  /** Clé de traduction à afficher, jamais un message brut du serveur. */
  errorKey?: TranslationKey;
  fieldErrors?: Record<string, string>;
};

const signInSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

const signUpSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email().trim().toLowerCase(),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => (value ? value : undefined)),
  password: z.string().min(8).max(200),
});

function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const flattened: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!flattened[key]) flattened[key] = issue.message;
  }
  return flattened;
}

export async function signInAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errorKey: "auth.invalidCredentials" };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Un compte créé via Google, Facebook ou WhatsApp n'a pas de mot de passe :
  // le message reste volontairement générique, sinon le formulaire
  // permettrait de découvrir quelles adresses existent déjà.
  if (
    !user ||
    !user.passwordHash ||
    !(await verifyPassword(parsed.data.password, user.passwordHash))
  ) {
    return { errorKey: "auth.invalidCredentials" };
  }

  await createSession(user.id, user.role as "CUSTOMER" | "ADMIN");
  await mergeGuestCartIntoUser(user.id);

  const next = sanitizeReturnTo(formData.get("next"));

  redirect(next ?? (user.role === "ADMIN" ? "/admin" : "/compte"));
}

export async function signUpAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    // `FormData.get` renvoie `null` pour un champ absent, valeur que
    // `z.string().optional()` refuse : on normalise en `undefined`.
    phone: formData.get("phone") ?? undefined,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: firstFieldErrors(parsed.error) };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existing) {
    return { errorKey: "auth.emailTaken" };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  await createSession(user.id, "CUSTOMER");
  await mergeGuestCartIntoUser(user.id);

  const next = sanitizeReturnTo(formData.get("next"));

  redirect(next ?? "/compte");
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
