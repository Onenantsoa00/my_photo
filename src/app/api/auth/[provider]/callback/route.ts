import { NextResponse, type NextRequest } from "next/server";

import { sanitizeReturnTo } from "@/lib/return-to";
import { createSession } from "@/server/auth";
import { mergeGuestCartIntoUser } from "@/server/cart";
import {
  OAUTH_STATE_COOKIE,
  OAuthError,
  exchangeCode,
  fetchProfile,
  findOrCreateUser,
  isProviderId,
  providerCallbackUrl,
  providerCredentials,
  readState,
  resolveBaseUrl,
} from "@/server/oauth";

/**
 * Retour du fournisseur : vérification de l'état, échange du code, récupération
 * du profil, ouverture de session. Toute anomalie renvoie vers la page de
 * connexion avec un motif traduit — jamais un message brut du fournisseur.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const baseUrl = resolveBaseUrl(request.url);

  if (!isProviderId(provider)) {
    return new NextResponse("Fournisseur inconnu", { status: 404 });
  }

  const fail = (reason: string) => {
    const response = NextResponse.redirect(new URL(`/connexion?erreur=${reason}`, baseUrl));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  };

  const url = new URL(request.url);

  if (url.searchParams.get("error")) {
    // Le client a refusé l'autorisation, ou le fournisseur a refusé la requête.
    return fail("annule");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieToken = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !cookieToken) return fail("etat");

  const stored = await readState(cookieToken);

  // Le nonce relie ce retour au départ du flux : sans cette comparaison, un
  // site tiers pourrait faire aboutir un callback forgé dans notre navigateur.
  if (!stored || stored.provider !== provider || stored.nonce !== state) return fail("etat");

  const credentials = providerCredentials(provider);
  if (!credentials) return fail("indisponible");

  try {
    const accessToken = await exchangeCode({
      provider,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      code,
      redirectUri: providerCallbackUrl(baseUrl, provider),
      codeVerifier: stored.codeVerifier,
    });

    const profile = await fetchProfile(provider, accessToken);
    const user = await findOrCreateUser(provider, profile);

    await createSession(user.id, user.role === "ADMIN" ? "ADMIN" : "CUSTOMER");
    await mergeGuestCartIntoUser(user.id);

    const destination =
      sanitizeReturnTo(stored.next) ?? (user.role === "ADMIN" ? "/admin" : "/compte");

    const response = NextResponse.redirect(new URL(destination, baseUrl));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    const reason = error instanceof OAuthError ? error.code : "echec";
    return fail(reason === "email_taken" ? "email_pris" : "echec");
  }
}
