"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { LOCALE_COOKIE, defaultLocale, isLocale } from "@/lib/i18n";

export async function setLocaleAction(formData: FormData): Promise<void> {
  const requested = String(formData.get("locale") ?? "");
  const locale = isLocale(requested) ? requested : defaultLocale;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
