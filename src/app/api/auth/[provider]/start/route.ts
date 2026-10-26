import { NextResponse, type NextRequest } from "next/server";

import { sanitizeReturnTo } from "@/lib/return-to";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE,
  buildAuthorizeUrl,
  isProviderId,
  newNonce,
  pkcePair,
  providerCallbackUrl,
  providerCredentials,
  resolveBaseUrl,
  signState,
} from "@/server/oauth";

/**
 * Départ du flux OAuth : on pose un cookie d'état signé puis on envoie le
 * client chez le fournisseur. Rien n'est écrit en base à cette étape.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!isProviderId(provider)) {
    return new NextResponse("Fournisseur inconnu", { status: 404 });
  }

  const credentials = providerCredentials(provider);

  if (!credentials) {
    // Aucune clé configurée : on revient sur la connexion avec un message
    // explicite plutôt que d'envoyer le client chez un fournisseur qui le
    // rejetterait avec une erreur incompréhensible.
    return NextResponse.redirect(
      new URL("/connexion?erreur=indisponible", resolveBaseUrl(request.url)),
    );
  }

  const next = sanitizeReturnTo(request.nextUrl.searchParams.get("next")) ?? "/compte";
  const pkce = credentials.definition.supportsPkce ? pkcePair() : null;
  const nonce = newNonce();

  const stateToken = await signState({
    provider,
    nonce,
    next,
    codeVerifier: pkce?.verifier ?? null,
  });

  const authorizeUrl = buildAuthorizeUrl({
    provider,
    clientId: credentials.clientId,
    redirectUri: providerCallbackUrl(resolveBaseUrl(request.url), provider),
    state: nonce,
    codeChallenge: pkce?.challenge,
  });

  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set(OAUTH_STATE_COOKIE, stateToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });

  return response;
}
