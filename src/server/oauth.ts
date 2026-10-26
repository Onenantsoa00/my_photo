import { createHash, randomBytes, randomUUID } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { prisma } from "@/lib/prisma";
import { findUserForSocialLogin } from "@/server/auth";

/**
 * Connexion avec Google et Facebook : flux « code d'autorisation » OAuth 2.0.
 *
 * Pourquoi pas de bibliothèque : le projet a déjà `jose` pour signer des jetons
 * et `fetch` est natif sur Node 24. Le flux complet tient en quelques dizaines
 * de lignes, contre une dépendance supplémentaire (et son cycle de mises à
 * jour) pour deux fournisseurs.
 *
 * Ce qui est vérifié à chaque étape :
 * - l'état (`state`) est signé et stocké dans un cookie `httpOnly` : un appel
 *   au callback venu d'un autre site ne peut pas aboutir (CSRF) ;
 * - le retour après connexion (`next`) voyage dans ce même jeton signé, jamais
 *   dans l'URL : aucune redirection ouverte possible ;
 * - Google utilise PKCE (`code_verifier` / `code_challenge`), ce qui rend le
 *   code d'autorisation inutilisable par un tiers qui l'intercepterait.
 */

export const OAUTH_STATE_COOKIE = "mp_oauth";
const STATE_MAX_AGE_SECONDS = 600; // 10 minutes

export type ProviderId = "google" | "facebook";

type ProviderDefinition = {
  id: ProviderId;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  supportsPkce: boolean;
  clientIdEnv: string;
  clientSecretEnv: string;
};

const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  google: {
    id: "google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    supportsPkce: true,
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  facebook: {
    id: "facebook",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    userInfoUrl: "https://graph.facebook.com/me?fields=id,name,email",
    scope: "email public_profile",
    supportsPkce: false,
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
  },
};

export function isProviderId(value: string): value is ProviderId {
  return value === "google" || value === "facebook";
}

export type ProviderCredentials = {
  definition: ProviderDefinition;
  clientId: string;
  clientSecret: string;
};

export function providerCredentials(provider: ProviderId): ProviderCredentials | null {
  const definition = PROVIDERS[provider];
  const clientId = process.env[definition.clientIdEnv];
  const clientSecret = process.env[definition.clientSecretEnv];

  if (!clientId || !clientSecret) return null;

  return { definition, clientId, clientSecret };
}

export type ProviderAvailability = Record<ProviderId, string | null>;

/**
 * Variables d'environnement manquantes pour chaque fournisseur.
 *
 * L'interface s'en sert pour désactiver un bouton plutôt que d'envoyer le
 * client vers une page d'erreur du fournisseur.
 */
export function providerAvailability(): ProviderAvailability {
  const missing = (provider: ProviderId): string | null => {
    const definition = PROVIDERS[provider];
    const absent = [definition.clientIdEnv, definition.clientSecretEnv].filter(
      (name) => !process.env[name],
    );
    return absent.length > 0 ? absent.join(", ") : null;
  };

  return {
    google: missing("google"),
    facebook: missing("facebook"),
  };
}

// ---------------------------------------------------------------------------
// Cookie d'état
// ---------------------------------------------------------------------------

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET est manquant ou trop court (32 caractères minimum).");
  }
  return new TextEncoder().encode(secret);
}

export type OAuthState = {
  provider: ProviderId;
  nonce: string;
  next: string;
  codeVerifier: string | null;
};

export async function signState(state: OAuthState): Promise<string> {
  return new SignJWT({
    provider: state.provider,
    nonce: state.nonce,
    next: state.next,
    codeVerifier: state.codeVerifier,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function readState(token: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });

    const provider = String(payload.provider ?? "");

    if (!isProviderId(provider)) return null;
    if (typeof payload.nonce !== "string" || typeof payload.next !== "string") return null;

    return {
      provider,
      nonce: payload.nonce,
      next: payload.next,
      codeVerifier: typeof payload.codeVerifier === "string" ? payload.codeVerifier : null,
    };
  } catch {
    return null;
  }
}

export const OAUTH_STATE_MAX_AGE = STATE_MAX_AGE_SECONDS;

// ---------------------------------------------------------------------------
// Étapes du flux
// ---------------------------------------------------------------------------

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export function newNonce(): string {
  return randomUUID();
}

export function buildAuthorizeUrl(options: {
  provider: ProviderId;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
}): string {
  const definition = PROVIDERS[options.provider];
  const url = new URL(definition.authorizeUrl);

  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", definition.scope);
  url.searchParams.set("state", options.state);

  if (definition.supportsPkce && options.codeChallenge) {
    url.searchParams.set("code_challenge", options.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  return url.toString();
}

export type ExternalProfile = {
  providerAccountId: string;
  email: string | null;
  /** Vrai seulement si le fournisseur garantit l'adresse (Google `email_verified`). */
  emailVerified: boolean;
  name: string;
};

export class OAuthError extends Error {
  constructor(public readonly code: "state" | "exchange" | "profile" | "email_taken") {
    super(code);
  }
}

export async function exchangeCode(options: {
  provider: ProviderId;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string | null;
}): Promise<string> {
  const definition = PROVIDERS[options.provider];
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: options.code,
    client_id: options.clientId,
    client_secret: options.clientSecret,
    redirect_uri: options.redirectUri,
  });

  if (definition.supportsPkce && options.codeVerifier) {
    body.set("code_verifier", options.codeVerifier);
  }

  const response = await fetch(definition.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new OAuthError("exchange");
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new OAuthError("exchange");

  return payload.access_token;
}

export async function fetchProfile(
  provider: ProviderId,
  accessToken: string,
): Promise<ExternalProfile> {
  const definition = PROVIDERS[provider];

  const response = await fetch(definition.userInfoUrl, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });

  if (!response.ok) throw new OAuthError("profile");

  const payload = (await response.json()) as Record<string, unknown>;

  if (provider === "google") {
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) throw new OAuthError("profile");

    return {
      providerAccountId: sub,
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === "string" && payload.name ? payload.name : "Client Google",
    };
  }

  const id = typeof payload.id === "string" ? payload.id : null;
  if (!id) throw new OAuthError("profile");

  return {
    providerAccountId: id,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    // Facebook ne renvoie pas d'indicateur de vérification : on refuse donc le
    // rattachement automatique à un compte existant (voir findOrCreateUser).
    emailVerified: false,
    name: typeof payload.name === "string" && payload.name ? payload.name : "Client Facebook",
  };
}

export type SocialUser = { id: string; email: string | null; name: string; role: string };

/**
 * Compte local correspondant au profil externe, créé si nécessaire.
 *
 * Règles, dans cet ordre :
 * 1. le couple (fournisseur, identifiant) déjà connu → connexion directe ;
 * 2. adresse **vérifiée** par le fournisseur et déjà présente en base →
 *    rattachement (le client retrouve ses commandes et ses créations) ;
 * 3. adresse non vérifiée déjà présente en base → refus explicite plutôt qu'un
 *    rattachement silencieux, qui permettrait de revendiquer le compte d'un
 *    tiers ;
 * 4. sinon → création du compte, sans mot de passe.
 */
export async function findOrCreateUser(
  provider: ProviderId,
  profile: ExternalProfile,
): Promise<SocialUser> {
  const link = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (link) return link.user;

  if (profile.email) {
    const existing = await findUserForSocialLogin({ email: profile.email });

    if (existing) {
      if (!profile.emailVerified) throw new OAuthError("email_taken");

      await prisma.oAuthAccount.create({
        data: {
          userId: existing.id,
          provider,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
        },
      });

      return existing;
    }
  }

  return prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name,
      // Un compte ouvert par un fournisseur n'a pas de mot de passe.
      passwordHash: null,
      accounts: {
        create: {
          provider,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
        },
      },
    },
  });
}

/**
 * Origine publique du site, utilisée pour construire l'URL de retour déclarée
 * au fournisseur (elle doit correspondre au caractère près à celle enregistrée
 * dans la console du fournisseur).
 */
export function resolveBaseUrl(requestUrl: string): string {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  return new URL(requestUrl).origin;
}

export function providerCallbackUrl(baseUrl: string, provider: ProviderId): string {
  return `${baseUrl}/api/auth/${provider}/callback`;
}
