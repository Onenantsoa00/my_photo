import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { translate, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/locale.server";
import { sanitizeReturnTo } from "@/lib/return-to";
import { getSessionUser } from "@/server/auth";
import { socialAvailability } from "@/server/social-login";

export const metadata: Metadata = {
  title: "Connexion",
};

/** Motifs d'échec renvoyés par les routes OAuth (`?erreur=…`). */
const ERROR_KEYS: Record<string, TranslationKey> = {
  indisponible: "auth.providerUnconfigured",
  etat: "auth.oauthState",
  annule: "auth.oauthCancelled",
  email_pris: "auth.oauthEmailTaken",
  echec: "auth.oauthFailed",
};

type SearchParams = Promise<{ next?: string; erreur?: string }>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const user = await getSessionUser();
  const next = sanitizeReturnTo(params.next);

  if (user) redirect(next ?? (user.role === "ADMIN" ? "/admin" : "/compte"));

  const errorKey = params.erreur ? ERROR_KEYS[params.erreur] : undefined;
  const availability = socialAvailability();

  return (
    <div className="container-page flex justify-center py-14">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">{translate(locale, "auth.signInTitle")}</h1>

        {next ? (
          <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">
            {translate(locale, "auth.signInToContinue")}
          </p>
        ) : null}

        {errorKey ? (
          <p className="mt-3 rounded-xl bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-700">
            {translate(locale, errorKey)}
          </p>
        ) : null}

        <div className="mt-6">
          <AuthForm mode="signIn" next={next} availability={availability} />
        </div>

        <div className="mt-6 rounded-xl bg-sand-100 p-3 text-xs text-ink-700">
          <p className="font-semibold">Comptes de démonstration</p>
          <p className="mt-1 font-mono">admin@myphoto.mg / Admin1234!</p>
          <p className="font-mono">client@myphoto.mg / Client1234!</p>
        </div>
      </div>
    </div>
  );
}
